import { useEffect, useState } from "react";

/**
 * ClientOnly component
 * Renders children only on the client side
 */
export function ClientOnly({ 
  children, 
  fallback = null 
}: { 
  children: () => React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return <>{fallback}</>;
  }

  return <>{children()}</>;
}