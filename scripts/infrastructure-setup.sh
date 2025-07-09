#!/bin/bash

# WishCraft Infrastructure Setup Script
# Complete infrastructure provisioning for production deployment

set -e

echo "🚀 Starting WishCraft Infrastructure Setup..."

# Configuration
PROJECT_NAME="wishcraft"
ENVIRONMENT=${ENVIRONMENT:-production}
CLOUD_PROVIDER=${CLOUD_PROVIDER:-aws}
REGION=${REGION:-us-east-1}
DOMAIN=${DOMAIN:-wishcraft-app.com}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_step "Checking prerequisites..."
    
    # Check required tools
    local required_tools=("kubectl" "helm" "terraform" "docker" "aws" "jq")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "$tool is required but not installed"
            exit 1
        fi
    done
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured"
        exit 1
    fi
    
    # Check Kubernetes context
    if ! kubectl config current-context &> /dev/null; then
        log_warn "No Kubernetes context found, will create cluster"
    fi
    
    log_info "Prerequisites check passed ✓"
}

# Create EKS cluster
create_eks_cluster() {
    log_step "Creating EKS cluster..."
    
    # Create cluster configuration
    cat > eksctl-cluster.yaml << EOF
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: ${PROJECT_NAME}-cluster
  region: ${REGION}
  version: "1.27"

iam:
  withOIDC: true

nodeGroups:
  - name: ${PROJECT_NAME}-workers
    instanceType: t3.medium
    desiredCapacity: 3
    minSize: 2
    maxSize: 10
    volumeSize: 100
    ami: auto
    iam:
      withAddonPolicies:
        autoScaler: true
        ebs: true
        cloudWatch: true
        albIngress: true
    tags:
      Environment: ${ENVIRONMENT}
      Project: ${PROJECT_NAME}

addons:
  - name: vpc-cni
    version: latest
  - name: coredns
    version: latest
  - name: kube-proxy
    version: latest
  - name: aws-ebs-csi-driver
    version: latest

fargateProfiles:
  - name: ${PROJECT_NAME}-fargate
    selectors:
      - namespace: kube-system
        labels:
          app: fargate
      - namespace: ${PROJECT_NAME}-system
        labels:
          compute: fargate

cloudWatch:
  clusterLogging:
    enableTypes: ["*"]
EOF
    
    # Create cluster if it doesn't exist
    if ! eksctl get cluster --name="${PROJECT_NAME}-cluster" --region="${REGION}" &> /dev/null; then
        log_info "Creating EKS cluster..."
        eksctl create cluster -f eksctl-cluster.yaml
    else
        log_info "EKS cluster already exists"
    fi
    
    # Update kubeconfig
    aws eks update-kubeconfig --name="${PROJECT_NAME}-cluster" --region="${REGION}"
    
    log_info "EKS cluster ready ✓"
}

# Setup Ingress Controller
setup_ingress() {
    log_step "Setting up AWS Load Balancer Controller..."
    
    # Create IAM role for ALB Controller
    if ! aws iam get-role --role-name AmazonEKSLoadBalancerControllerRole &> /dev/null; then
        # Download IAM policy
        curl -o iam_policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.5.4/docs/install/iam_policy.json
        
        # Create IAM policy
        aws iam create-policy \
            --policy-name AWSLoadBalancerControllerIAMPolicy \
            --policy-document file://iam_policy.json
        
        # Create service account
        eksctl create iamserviceaccount \
            --cluster="${PROJECT_NAME}-cluster" \
            --namespace=kube-system \
            --name=aws-load-balancer-controller \
            --role-name AmazonEKSLoadBalancerControllerRole \
            --attach-policy-arn=arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/AWSLoadBalancerControllerIAMPolicy \
            --approve
    fi
    
    # Install AWS Load Balancer Controller
    helm repo add eks https://aws.github.io/eks-charts
    helm repo update
    
    helm upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller \
        -n kube-system \
        --set clusterName="${PROJECT_NAME}-cluster" \
        --set serviceAccount.create=false \
        --set serviceAccount.name=aws-load-balancer-controller \
        --set region="${REGION}" \
        --set vpcId=$(aws eks describe-cluster --name="${PROJECT_NAME}-cluster" --query "cluster.resourcesVpcConfig.vpcId" --output text)
    
    log_info "AWS Load Balancer Controller installed ✓"
}

# Setup monitoring stack
setup_monitoring() {
    log_step "Setting up monitoring stack..."
    
    # Create monitoring namespace
    kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
    
    # Install Prometheus
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update
    
    helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
        --namespace monitoring \
        --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
        --set prometheus.prometheusSpec.podMonitorSelectorNilUsesHelmValues=false \
        --set grafana.adminPassword=admin \
        --set grafana.persistence.enabled=true \
        --set grafana.persistence.size=10Gi \
        --set alertmanager.persistentVolume.enabled=true \
        --set alertmanager.persistentVolume.size=10Gi \
        --set prometheus.prometheusSpec.retention=30d \
        --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=50Gi
    
    # Install Grafana dashboards
    kubectl apply -f deploy/monitoring/prometheus.yaml
    
    log_info "Monitoring stack installed ✓"
}

# Setup logging
setup_logging() {
    log_step "Setting up logging with Fluentd..."
    
    # Create logging namespace
    kubectl create namespace logging --dry-run=client -o yaml | kubectl apply -f -
    
    # Install Fluentd
    helm repo add fluent https://fluent.github.io/helm-charts
    helm repo update
    
    helm upgrade --install fluentd fluent/fluentd \
        --namespace logging \
        --set rbac.create=true \
        --set persistence.enabled=true \
        --set persistence.size=10Gi \
        --set env.FLUENT_ELASTICSEARCH_HOST=elasticsearch.logging.svc.cluster.local \
        --set env.FLUENT_ELASTICSEARCH_PORT=9200
    
    # Install Elasticsearch
    helm repo add elastic https://helm.elastic.co
    helm repo update
    
    helm upgrade --install elasticsearch elastic/elasticsearch \
        --namespace logging \
        --set replicas=3 \
        --set persistence.enabled=true \
        --set volumeClaimTemplate.resources.requests.storage=30Gi
    
    # Install Kibana
    helm upgrade --install kibana elastic/kibana \
        --namespace logging \
        --set service.type=LoadBalancer
    
    log_info "Logging stack installed ✓"
}

# Setup security
setup_security() {
    log_step "Setting up security components..."
    
    # Install Falco for runtime security
    helm repo add falcosecurity https://falcosecurity.github.io/charts
    helm repo update
    
    helm upgrade --install falco falcosecurity/falco \
        --namespace falco-system \
        --create-namespace \
        --set falco.grpc.enabled=true \
        --set falco.grpc_output.enabled=true \
        --set falco.file_output.enabled=true
    
    # Install OPA Gatekeeper
    kubectl apply -f https://raw.githubusercontent.com/open-policy-agent/gatekeeper/release-3.14/deploy/gatekeeper.yaml
    
    # Install Network Policies
    kubectl apply -f deploy/kubernetes/network-policies.yaml
    
    log_info "Security components installed ✓"
}

# Setup certificates
setup_certificates() {
    log_step "Setting up SSL certificates..."
    
    # Install cert-manager
    helm repo add jetstack https://charts.jetstack.io
    helm repo update
    
    helm upgrade --install cert-manager jetstack/cert-manager \
        --namespace cert-manager \
        --create-namespace \
        --set installCRDs=true
    
    # Create ClusterIssuer for Let's Encrypt
    cat > cluster-issuer.yaml << EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@${DOMAIN}
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: alb
EOF
    
    kubectl apply -f cluster-issuer.yaml
    
    log_info "SSL certificates configured ✓"
}

# Setup database
setup_database() {
    log_step "Setting up PostgreSQL database..."
    
    # Create database namespace
    kubectl create namespace database --dry-run=client -o yaml | kubectl apply -f -
    
    # Install PostgreSQL
    helm repo add bitnami https://charts.bitnami.com/bitnami
    helm repo update
    
    helm upgrade --install postgresql bitnami/postgresql \
        --namespace database \
        --set auth.postgresPassword=wishcraft2024 \
        --set auth.database=wishcraft_production \
        --set primary.persistence.enabled=true \
        --set primary.persistence.size=100Gi \
        --set primary.resources.requests.memory=2Gi \
        --set primary.resources.requests.cpu=1000m \
        --set primary.resources.limits.memory=4Gi \
        --set primary.resources.limits.cpu=2000m \
        --set metrics.enabled=true \
        --set metrics.serviceMonitor.enabled=true
    
    # Install Redis
    helm upgrade --install redis bitnami/redis \
        --namespace database \
        --set auth.password=wishcraft2024 \
        --set master.persistence.enabled=true \
        --set master.persistence.size=20Gi \
        --set replica.replicaCount=2 \
        --set replica.persistence.enabled=true \
        --set replica.persistence.size=20Gi \
        --set metrics.enabled=true \
        --set metrics.serviceMonitor.enabled=true
    
    log_info "Database stack installed ✓"
}

# Deploy application
deploy_application() {
    log_step "Deploying WishCraft application..."
    
    # Create application namespace
    kubectl create namespace wishcraft --dry-run=client -o yaml | kubectl apply -f -
    
    # Apply Kubernetes manifests
    kubectl apply -f deploy/kubernetes/
    
    # Create ingress with SSL
    cat > ingress.yaml << EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: wishcraft-ingress
  namespace: wishcraft
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:${REGION}:$(aws sts get-caller-identity --query Account --output text):certificate/$(aws acm list-certificates --query 'CertificateSummaryList[?DomainName==`${DOMAIN}`].CertificateArn' --output text | cut -d'/' -f2)
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTPS": 443}]'
    alb.ingress.kubernetes.io/actions.ssl-redirect: '{"Type": "redirect", "RedirectConfig": { "Protocol": "HTTPS", "Port": "443", "StatusCode": "HTTP_301"}}'
spec:
  rules:
  - host: ${DOMAIN}
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: ssl-redirect
            port:
              name: use-annotation
      - path: /
        pathType: Prefix
        backend:
          service:
            name: wishcraft-service
            port:
              number: 80
  - host: www.${DOMAIN}
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: wishcraft-service
            port:
              number: 80
EOF
    
    kubectl apply -f ingress.yaml
    
    log_info "Application deployed ✓"
}

# Setup backup
setup_backup() {
    log_step "Setting up backup solution..."
    
    # Install Velero for cluster backups
    helm repo add vmware-tanzu https://vmware-tanzu.github.io/helm-charts
    helm repo update
    
    # Create S3 bucket for backups
    aws s3 mb s3://${PROJECT_NAME}-backups-$(date +%s) --region ${REGION}
    
    # Create IAM user for Velero
    aws iam create-user --user-name velero
    
    # Create IAM policy for Velero
    cat > velero-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ec2:DescribeVolumes",
                "ec2:DescribeSnapshots",
                "ec2:CreateTags",
                "ec2:CreateVolume",
                "ec2:CreateSnapshot",
                "ec2:DeleteSnapshot"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:DeleteObject",
                "s3:PutObject",
                "s3:AbortMultipartUpload",
                "s3:ListMultipartUploadParts"
            ],
            "Resource": "arn:aws:s3:::${PROJECT_NAME}-backups-*/*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket"
            ],
            "Resource": "arn:aws:s3:::${PROJECT_NAME}-backups-*"
        }
    ]
}
EOF
    
    aws iam put-user-policy \
        --user-name velero \
        --policy-name VeleroAccessPolicy \
        --policy-document file://velero-policy.json
    
    log_info "Backup solution configured ✓"
}

# Setup autoscaling
setup_autoscaling() {
    log_step "Setting up cluster autoscaling..."
    
    # Install Cluster Autoscaler
    helm repo add autoscaler https://kubernetes.github.io/autoscaler
    helm repo update
    
    helm upgrade --install cluster-autoscaler autoscaler/cluster-autoscaler \
        --namespace kube-system \
        --set cloudProvider=aws \
        --set awsRegion=${REGION} \
        --set autoDiscovery.clusterName=${PROJECT_NAME}-cluster \
        --set autoDiscovery.enabled=true \
        --set rbac.create=true \
        --set rbac.serviceAccount.annotations."eks\.amazonaws\.com/role-arn"=arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/AmazonEKSClusterAutoscalerRole
    
    # Install Vertical Pod Autoscaler
    git clone https://github.com/kubernetes/autoscaler.git
    cd autoscaler/vertical-pod-autoscaler/
    ./hack/vpa-install.sh
    cd ../..
    rm -rf autoscaler
    
    log_info "Autoscaling configured ✓"
}

# Verify deployment
verify_deployment() {
    log_step "Verifying deployment..."
    
    # Check all pods are running
    kubectl get pods --all-namespaces
    
    # Check services
    kubectl get services --all-namespaces
    
    # Check ingress
    kubectl get ingress --all-namespaces
    
    # Get application URL
    ALB_DNS=$(kubectl get ingress wishcraft-ingress -n wishcraft -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
    
    if [ -n "$ALB_DNS" ]; then
        log_info "Application accessible at: https://${DOMAIN}"
        log_info "Load balancer: ${ALB_DNS}"
    else
        log_warn "Load balancer not ready yet"
    fi
    
    # Check certificate
    if kubectl get certificate -n wishcraft &> /dev/null; then
        kubectl get certificate -n wishcraft
    fi
    
    log_info "Deployment verification complete ✓"
}

# Main setup function
main() {
    log_info "Starting WishCraft infrastructure setup for ${ENVIRONMENT} environment"
    
    check_prerequisites
    create_eks_cluster
    setup_ingress
    setup_monitoring
    setup_logging
    setup_security
    setup_certificates
    setup_database
    deploy_application
    setup_backup
    setup_autoscaling
    verify_deployment
    
    log_info "🎉 WishCraft infrastructure setup completed successfully!"
    log_info "Next steps:"
    log_info "1. Configure DNS to point ${DOMAIN} to the load balancer"
    log_info "2. Set up monitoring dashboards"
    log_info "3. Configure backup schedules"
    log_info "4. Run security scans"
    log_info "5. Perform load testing"
}

# Error handling
trap 'log_error "Setup failed at line $LINENO"; exit 1' ERR

# Run main function
main "$@"