import React from "react";
import { Button, Card, BlockStack, Text } from "@shopify/polaris";
import { ErrorBoundary, withErrorBoundary, useErrorHandler } from "./ErrorBoundary";

// Example component that might throw errors
function ProblematicComponent() {
  const [shouldError, setShouldError] = React.useState(false);
  
  if (shouldError) {
    throw new Error("This is a test error from ProblematicComponent");
  }
  
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="h3" variant="headingSm">Problematic Component</Text>
        <Text as="p">This component can throw errors for testing.</Text>
        <Button onClick={() => setShouldError(true)}>
          Throw Error
        </Button>
      </BlockStack>
    </Card>
  );
}

// Example of HOC usage
const SafeProblematicComponent = withErrorBoundary(ProblematicComponent, {
  level: 'component',
  onError: (error, errorInfo) => {
    console.log('Error caught by HOC:', error.message);
  }
});

// Example of manual error handling
function ManualErrorComponent() {
  const handleError = useErrorHandler();
  
  const throwManualError = () => {
    try {
      // Simulate some operation that might fail
      throw new Error("Manual error triggered");
    } catch (error) {
      handleError(error as Error);
    }
  };
  
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="h3" variant="headingSm">Manual Error Handling</Text>
        <Text as="p">This demonstrates manual error triggering.</Text>
        <Button onClick={throwManualError}>
          Trigger Manual Error
        </Button>
      </BlockStack>
    </Card>
  );
}

// Main example component
export function ErrorBoundaryExample() {
  return (
    <BlockStack gap="400">
      <Text as="h2" variant="headingMd">Error Boundary Examples</Text>
      
      {/* Page-level error boundary */}
      <ErrorBoundary level="page">
        <Text as="h3" variant="headingSm">Page-level Error Boundary</Text>
        <ProblematicComponent />
      </ErrorBoundary>
      
      {/* Component-level error boundary */}
      <ErrorBoundary level="component">
        <Text as="h3" variant="headingSm">Component-level Error Boundary</Text>
        <ProblematicComponent />
      </ErrorBoundary>
      
      {/* Widget-level error boundary */}
      <ErrorBoundary level="widget">
        <Text as="h3" variant="headingSm">Widget-level Error Boundary</Text>
        <ProblematicComponent />
      </ErrorBoundary>
      
      {/* HOC usage */}
      <Text as="h3" variant="headingSm">HOC Usage</Text>
      <SafeProblematicComponent />
      
      {/* Manual error handling */}
      <ErrorBoundary level="component">
        <ManualErrorComponent />
      </ErrorBoundary>
    </BlockStack>
  );
}