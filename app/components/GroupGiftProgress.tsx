import { useEffect, useState } from "react";
import { useFetcher } from "@remix-run/react";
import { 
  Card, 
  Text, 
  ProgressBar, 
  BlockStack, 
  InlineStack, 
  Badge, 
  Banner,
  Spinner
} from "@shopify/polaris";

interface GroupGiftProgressProps {
  groupGiftId: string;
  initialData: {
    currentAmount: number;
    targetAmount: number;
    contributorCount: number;
    status: string;
    deadline?: string;
  };
  showContributors?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function GroupGiftProgress({ 
  groupGiftId, 
  initialData, 
  showContributors = true,
  autoRefresh = true,
  refreshInterval = 30000 // 30 seconds
}: GroupGiftProgressProps) {
  const fetcher = useFetcher();
  const [data, setData] = useState(initialData);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isLive, setIsLive] = useState(false);

  // Auto-refresh progress data
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetcher.load(`/api/group-gift/${groupGiftId}/progress`);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [groupGiftId, autoRefresh, refreshInterval, fetcher]);

  // Update data when fetcher returns
  useEffect(() => {
    if (fetcher.data && !fetcher.data.error) {
      const newData = fetcher.data.progress;
      
      // Check if data has changed
      const hasChanged = 
        newData.currentAmount !== data.currentAmount ||
        newData.contributorCount !== data.contributorCount ||
        newData.status !== data.status;

      if (hasChanged) {
        setData(newData);
        setLastUpdate(new Date());
        setIsLive(true);
        
        // Show live indicator for 3 seconds
        setTimeout(() => setIsLive(false), 3000);
      }
    }
  }, [fetcher.data, data]);

  const progressPercentage = Math.min((data.currentAmount / data.targetAmount) * 100, 100);
  const remainingAmount = Math.max(data.targetAmount - data.currentAmount, 0);
  const isCompleted = data.currentAmount >= data.targetAmount;
  const isExpired = data.deadline ? new Date() > new Date(data.deadline) : false;

  const daysRemaining = data.deadline 
    ? Math.ceil((new Date(data.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <Card>
      <BlockStack gap="400">
        {/* Header with live indicator */}
        <InlineStack align="space-between" blockAlign="center">
          <Text variant="headingMd" as="h3">Progress</Text>
          
          <InlineStack gap="200" blockAlign="center">
            {isLive && (
              <InlineStack gap="100" blockAlign="center">
                <div 
                  style={{ 
                    width: '8px', 
                    height: '8px', 
                    backgroundColor: '#00a047', 
                    borderRadius: '50%',
                    animation: 'pulse 2s infinite'
                  }} 
                />
                <Text variant="bodySm" tone="subdued">Live</Text>
              </InlineStack>
            )}
            
            {fetcher.state === "loading" && (
              <Spinner size="small" />
            )}
          </InlineStack>
        </InlineStack>

        {/* Progress visualization */}
        <BlockStack gap="200">
          <InlineStack align="space-between">
            <Text variant="bodyMd" fontWeight="medium">
              ${data.currentAmount.toFixed(2)} raised
            </Text>
            <Text variant="bodyMd" tone="subdued">
              ${data.targetAmount.toFixed(2)} goal
            </Text>
          </InlineStack>
          
          <ProgressBar 
            progress={progressPercentage} 
            size="large"
            tone={isCompleted ? "success" : "primary"}
          />
          
          <InlineStack align="space-between">
            <Text variant="bodySm" tone="subdued">
              {data.contributorCount} contributor{data.contributorCount !== 1 ? 's' : ''}
            </Text>
            
            <Text variant="bodySm" tone="subdued">
              {progressPercentage.toFixed(1)}% complete
            </Text>
          </InlineStack>
        </BlockStack>

        {/* Status banners */}
        {isCompleted && (
          <Banner tone="success">
            <Text>🎉 Goal reached! Order will be placed automatically.</Text>
          </Banner>
        )}

        {isExpired && !isCompleted && (
          <Banner tone="critical">
            <Text>This group gift has expired. Refunds will be processed automatically.</Text>
          </Banner>
        )}

        {!isCompleted && !isExpired && remainingAmount > 0 && (
          <Banner tone="info">
            <InlineStack gap="200">
              <Text>${remainingAmount.toFixed(2)} remaining</Text>
              {daysRemaining !== null && daysRemaining > 0 && (
                <Badge tone="attention">
                  {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left
                </Badge>
              )}
            </InlineStack>
          </Banner>
        )}

        {/* Quick stats */}
        <InlineStack gap="400">
          <div>
            <Text variant="headingSm" as="h4">
              ${(data.contributorCount > 0 ? data.currentAmount / data.contributorCount : 0).toFixed(2)}
            </Text>
            <Text variant="bodySm" tone="subdued">Avg. contribution</Text>
          </div>
          
          <div>
            <Text variant="headingSm" as="h4">
              {progressPercentage.toFixed(0)}%
            </Text>
            <Text variant="bodySm" tone="subdued">of goal</Text>
          </div>

          {daysRemaining !== null && (
            <div>
              <Text variant="headingSm" as="h4">
                {Math.max(daysRemaining, 0)}
              </Text>
              <Text variant="bodySm" tone="subdued">days left</Text>
            </div>
          )}
        </InlineStack>

        {/* Last update timestamp */}
        <Text variant="bodySm" tone="subdued" alignment="center">
          Last updated: {lastUpdate.toLocaleTimeString()}
        </Text>
      </BlockStack>

      <style jsx>{`
        @keyframes pulse {
          0% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
          100% {
            opacity: 1;
          }
        }
      `}</style>
    </Card>
  );
}

// Separate component for mini progress display
export function GroupGiftMiniProgress({ 
  currentAmount, 
  targetAmount, 
  contributorCount,
  showText = true 
}: {
  currentAmount: number;
  targetAmount: number;
  contributorCount: number;
  showText?: boolean;
}) {
  const progressPercentage = Math.min((currentAmount / targetAmount) * 100, 100);
  const isCompleted = currentAmount >= targetAmount;

  return (
    <BlockStack gap="200">
      <ProgressBar 
        progress={progressPercentage} 
        size="small"
        tone={isCompleted ? "success" : "primary"}
      />
      
      {showText && (
        <InlineStack align="space-between">
          <Text variant="bodySm" tone="subdued">
            ${currentAmount.toFixed(2)} of ${targetAmount.toFixed(2)}
          </Text>
          <Text variant="bodySm" tone="subdued">
            {contributorCount} contributor{contributorCount !== 1 ? 's' : ''}
          </Text>
        </InlineStack>
      )}
    </BlockStack>
  );
}