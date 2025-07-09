import { useRouteError, isRouteErrorResponse, Link } from "@remix-run/react";
import { Card, Page, Button, Text, BlockStack, InlineStack } from "@shopify/polaris";
import { handleCustomerAuthError } from "~/lib/customer-auth.server";

/**
 * Authentication Error Boundary
 * Handles authentication failures gracefully with user-friendly messages
 */
export function AuthErrorBoundary() {
  const error = useRouteError();
  
  // Handle different types of errors
  if (isRouteErrorResponse(error)) {
    switch (error.status) {
      case 401:
        return <UnauthorizedError />;
      case 403:
        return <ForbiddenError />;
      case 404:
        return <NotFoundError />;
      default:
        return <GenericError status={error.status} statusText={error.statusText} />;
    }
  }
  
  // Handle authentication errors
  if (error instanceof Error) {
    const authError = handleCustomerAuthError(error);
    return <AuthenticationError error={authError} />;
  }
  
  return <GenericError />;
}

function UnauthorizedError() {
  return (
    <Page title="Authentication Required">
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">
            Sign in required
          </Text>
          
          <Text as="p">
            You need to sign in to access this page. Please authenticate with your account to continue.
          </Text>
          
          <InlineStack gap="300">
            <Button
              variant="primary"
              url="/customer/login"
            >
              Customer Sign In
            </Button>
            
            <Button
              variant="secondary"
              url="/auth/login"
            >
              Admin Sign In
            </Button>
          </InlineStack>
          
          <Text as="p" variant="bodySm" tone="subdued">
            If you're having trouble signing in, please contact support or try again later.
          </Text>
        </BlockStack>
      </Card>
    </Page>
  );
}

function ForbiddenError() {
  return (
    <Page title="Access Denied">
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">
            Access denied
          </Text>
          
          <Text as="p">
            You don't have permission to access this resource. This could be because:
          </Text>
          
          <div>
            <ul>
              <li>The registry is private and you don't have access</li>
              <li>You need additional permissions for this feature</li>
              <li>Your session has expired</li>
            </ul>
          </div>
          
          <InlineStack gap="300">
            <Button
              variant="primary"
              url="/customer/login"
            >
              Sign In Again
            </Button>
            
            <Button
              variant="secondary"
              url="/registries"
            >
              Browse Public Registries
            </Button>
          </InlineStack>
        </BlockStack>
      </Card>
    </Page>
  );
}

function NotFoundError() {
  return (
    <Page title="Page Not Found">
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">
            Page not found
          </Text>
          
          <Text as="p">
            The page you're looking for doesn't exist or may have been moved.
          </Text>
          
          <InlineStack gap="300">
            <Button
              variant="primary"
              url="/"
            >
              Go Home
            </Button>
            
            <Button
              variant="secondary"
              url="/registries"
            >
              Browse Registries
            </Button>
          </InlineStack>
        </BlockStack>
      </Card>
    </Page>
  );
}

interface AuthenticationErrorProps {
  error: {
    error: string;
    code: string;
    statusCode: number;
  };
}

function AuthenticationError({ error }: AuthenticationErrorProps) {
  const isCustomerError = error.code.includes('CUSTOMER') || error.code.includes('TOKEN');
  
  return (
    <Page title="Authentication Error">
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">
            Authentication failed
          </Text>
          
          <Text as="p" tone="critical">
            {error.error}
          </Text>
          
          {error.code === 'TOKEN_EXPIRED' && (
            <Text as="p">
              Your session has expired. Please sign in again to continue.
            </Text>
          )}
          
          {error.code === 'ACCESS_DENIED' && (
            <Text as="p">
              Access was denied during authentication. Please check your permissions or try again.
            </Text>
          )}
          
          <InlineStack gap="300">
            <Button
              variant="primary"
              url={isCustomerError ? "/customer/login" : "/auth/login"}
            >
              {isCustomerError ? "Customer Sign In" : "Admin Sign In"}
            </Button>
            
            <Button
              variant="secondary"
              url="/"
            >
              Go Home
            </Button>
          </InlineStack>
          
          {error.code === 'AUTH_FAILED' && (
            <Text as="p" variant="bodySm" tone="subdued">
              If this problem persists, please contact support with error code: {error.code}
            </Text>
          )}
        </BlockStack>
      </Card>
    </Page>
  );
}

interface GenericErrorProps {
  status?: number;
  statusText?: string;
}

function GenericError({ status, statusText }: GenericErrorProps = {}) {
  return (
    <Page title="Something went wrong">
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">
            Oops! Something went wrong
          </Text>
          
          {status && (
            <Text as="p" tone="critical">
              Error {status}: {statusText || "An unexpected error occurred"}
            </Text>
          )}
          
          <Text as="p">
            We're sorry, but something unexpected happened. Please try again or contact support if the problem persists.
          </Text>
          
          <InlineStack gap="300">
            <Button
              variant="primary"
              onClick={() => window.location.reload()}
            >
              Try Again
            </Button>
            
            <Button
              variant="secondary"
              url="/"
            >
              Go Home
            </Button>
          </InlineStack>
        </BlockStack>
      </Card>
    </Page>
  );
}

/**
 * Simple error boundary for authentication routes
 */
export function SimpleErrorBoundary() {
  const error = useRouteError();
  
  if (isRouteErrorResponse(error) && error.status === 401) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h2>Authentication Required</h2>
        <p>Please sign in to continue.</p>
        <Link to="/customer/login">Sign In</Link>
      </div>
    );
  }
  
  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h2>Something went wrong</h2>
      <p>Please try again or contact support.</p>
      <Link to="/">Go Home</Link>
    </div>
  );
}