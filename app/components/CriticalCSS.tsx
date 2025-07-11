interface CriticalCSSProps {
  styles: string;
}

export function CriticalCSS({ styles }: CriticalCSSProps) {
  if (!styles) return null;
  
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: styles,
      }}
    />
  );
}