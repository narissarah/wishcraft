/**
 * Contrast Validator Component
 * Automated color contrast validation for accessibility compliance
 */

import React, { useState, useEffect } from 'react';
import { Badge, Box, InlineStack, Text, Button, Modal, BlockStack, Card } from '@shopify/polaris';
import { AlertCircleIcon, CheckCircleIcon, InfoIcon } from '@shopify/polaris-icons';
import { colorContrast } from '~/lib/accessibility';
import { useAccessibleColors } from '~/components/ThemeProvider';

interface ContrastValidatorProps {
  foregroundColor: string;
  backgroundColor: string;
  textSize?: 'normal' | 'large';
  showDetails?: boolean;
  onValidationChange?: (isValid: boolean, ratio: number) => void;
}

interface ContrastResult {
  ratio: number;
  isValidAA: boolean;
  isValidAAA: boolean;
  level: 'fail' | 'aa' | 'aaa';
  color: 'critical' | 'warning' | 'success';
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): [number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : null;
}

/**
 * Calculate contrast ratio and compliance
 */
function calculateContrast(foreground: string, background: string, isLargeText: boolean = false): ContrastResult {
  const fg = hexToRgb(foreground);
  const bg = hexToRgb(background);
  
  if (!fg || !bg) {
    return {
      ratio: 0,
      isValidAA: false,
      isValidAAA: false,
      level: 'fail',
      color: 'critical'
    };
  }
  
  const ratio = colorContrast.getContrastRatio(fg, bg);
  const isValidAA = colorContrast.meetsWCAGAA(fg, bg, isLargeText);
  const isValidAAA = colorContrast.meetsWCAGAAA(fg, bg, isLargeText);
  
  let level: 'fail' | 'aa' | 'aaa' = 'fail';
  let color: 'critical' | 'warning' | 'success' = 'critical';
  
  if (isValidAAA) {
    level = 'aaa';
    color = 'success';
  } else if (isValidAA) {
    level = 'aa';
    color = 'success';
  } else if (ratio >= 3) {
    level = 'aa';
    color = 'warning';
  }
  
  return {
    ratio,
    isValidAA,
    isValidAAA,
    level,
    color
  };
}

export function ContrastValidator({ 
  foregroundColor, 
  backgroundColor, 
  textSize = 'normal', 
  showDetails = false,
  onValidationChange
}: ContrastValidatorProps) {
  const [contrastResult, setContrastResult] = useState<ContrastResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  // const { getAccessiblePair } = useAccessibleColors(); // Uncomment when needed
  
  const isLargeText = textSize === 'large';
  
  // Calculate contrast when colors change
  useEffect(() => {
    if (foregroundColor && backgroundColor) {
      const result = calculateContrast(foregroundColor, backgroundColor, isLargeText);
      setContrastResult(result);
      
      if (onValidationChange) {
        onValidationChange(result.isValidAA, result.ratio);
      }
    }
  }, [foregroundColor, backgroundColor, isLargeText, onValidationChange]);
  
  if (!contrastResult) return null;
  
  const getBadgeContent = () => {
    const ratio = contrastResult.ratio.toFixed(2);
    switch (contrastResult.level) {
      case 'aaa':
        return `AAA (${ratio}:1)`;
      case 'aa':
        return `AA (${ratio}:1)`;
      default:
        return `${ratio}:1`;
    }
  };
  
  const getIcon = () => {
    switch (contrastResult.level) {
      case 'aaa':
      case 'aa':
        return CheckCircleIcon;
      default:
        return AlertCircleIcon;
    }
  };
  
  const getHelpText = () => {
    const minRatio = isLargeText ? 3 : 4.5;
    // const aaaRatio = isLargeText ? 4.5 : 7; // Uncomment when needed
    
    if (contrastResult.isValidAAA) {
      return 'Excellent contrast - meets AAA standards';
    } else if (contrastResult.isValidAA) {
      return 'Good contrast - meets AA standards';
    } else if (contrastResult.ratio >= minRatio - 0.5) {
      return 'Close to meeting AA standards';
    } else {
      return `Needs improvement - minimum ratio is ${minRatio}:1`;
    }
  };
  
  const getSuggestions = () => {
    if (contrastResult.isValidAA) return [];
    
    const suggestions = [
      'Try a darker foreground color',
      'Try a lighter background color',
      'Use a different color combination',
      'Consider using Polaris semantic tokens'
    ];
    
    return suggestions;
  };
  
  const previewStyle = {
    backgroundColor,
    color: foregroundColor,
    padding: '12px 16px',
    borderRadius: '6px',
    fontSize: isLargeText ? '18px' : '14px',
    fontWeight: isLargeText ? 'bold' : 'normal',
    border: '1px solid #e0e0e0'
  };
  
  return (
    <>
      <Box>
        <InlineStack gap="200" align="start">
          <Badge 
            tone={contrastResult.color} 
            icon={getIcon()}
            size="small"
          >
            {getBadgeContent()}
          </Badge>
          
          {showDetails && (
            <Button
              variant="plain"
              size="micro"
              icon={InfoIcon}
              onClick={() => setShowModal(true)}
              accessibilityLabel="Show contrast details"
            >
              Details
            </Button>
          )}
        </InlineStack>
        
        <Box paddingBlockStart="100">
          <Text as="p" variant="bodySm" tone="subdued">
            {getHelpText()}
          </Text>
        </Box>
      </Box>
      
      {showModal && (
        <Modal
          open={showModal}
          onClose={() => setShowModal(false)}
          title="Color Contrast Analysis"
          primaryAction={{
            content: 'Close',
            onAction: () => setShowModal(false)
          }}
        >
          <Modal.Section>
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">Current Colors</Text>
                  <div style={previewStyle}>
                    Sample text with current colors
                  </div>
                  <InlineStack gap="400">
                    <Box>
                      <Text as="p" variant="bodySm" tone="subdued">Foreground</Text>
                      <Text as="p" variant="bodyMd" fontWeight="medium">{foregroundColor}</Text>
                    </Box>
                    <Box>
                      <Text as="p" variant="bodySm" tone="subdued">Background</Text>
                      <Text as="p" variant="bodyMd" fontWeight="medium">{backgroundColor}</Text>
                    </Box>
                  </InlineStack>
                </BlockStack>
              </Card>
              
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">Contrast Analysis</Text>
                  <InlineStack gap="400">
                    <Box>
                      <Text as="p" variant="bodySm" tone="subdued">Contrast Ratio</Text>
                      <Text as="p" variant="bodyMd" fontWeight="medium">
                        {contrastResult.ratio.toFixed(2)}:1
                      </Text>
                    </Box>
                    <Box>
                      <Text as="p" variant="bodySm" tone="subdued">Text Size</Text>
                      <Text as="p" variant="bodyMd" fontWeight="medium">
                        {isLargeText ? 'Large (18px+)' : 'Normal (14px)'}
                      </Text>
                    </Box>
                  </InlineStack>
                  
                  <InlineStack gap="200">
                    <Badge 
                      tone={contrastResult.isValidAA ? 'success' : 'critical'}
                      icon={contrastResult.isValidAA ? CheckCircleIcon : AlertCircleIcon}
                    >
                      {`WCAG AA ${contrastResult.isValidAA ? 'Pass' : 'Fail'}`}
                    </Badge>
                    <Badge 
                      tone={contrastResult.isValidAAA ? 'success' : 'warning'}
                      icon={contrastResult.isValidAAA ? CheckCircleIcon : AlertCircleIcon}
                    >
                      {`WCAG AAA ${contrastResult.isValidAAA ? 'Pass' : 'Fail'}`}
                    </Badge>
                  </InlineStack>
                </BlockStack>
              </Card>
              
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">Standards</Text>
                  <BlockStack gap="200">
                    <InlineStack gap="200">
                      <Text as="p" variant="bodySm" tone="subdued">AA Normal:</Text>
                      <Text as="p" variant="bodySm">4.5:1 minimum</Text>
                    </InlineStack>
                    <InlineStack gap="200">
                      <Text as="p" variant="bodySm" tone="subdued">AA Large:</Text>
                      <Text as="p" variant="bodySm">3:1 minimum</Text>
                    </InlineStack>
                    <InlineStack gap="200">
                      <Text as="p" variant="bodySm" tone="subdued">AAA Normal:</Text>
                      <Text as="p" variant="bodySm">7:1 minimum</Text>
                    </InlineStack>
                    <InlineStack gap="200">
                      <Text as="p" variant="bodySm" tone="subdued">AAA Large:</Text>
                      <Text as="p" variant="bodySm">4.5:1 minimum</Text>
                    </InlineStack>
                  </BlockStack>
                </BlockStack>
              </Card>
              
              {getSuggestions().length > 0 && (
                <Card>
                  <BlockStack gap="300">
                    <Text as="h3" variant="headingSm">Suggestions</Text>
                    <BlockStack gap="100">
                      {getSuggestions().map((suggestion, index) => (
                        <InlineStack key={index} gap="200">
                          <Text as="p" variant="bodySm">•</Text>
                          <Text as="p" variant="bodySm">{suggestion}</Text>
                        </InlineStack>
                      ))}
                    </BlockStack>
                  </BlockStack>
                </Card>
              )}
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}
    </>
  );
}

/**
 * Bulk contrast validator for multiple color combinations
 */
interface BulkContrastValidatorProps {
  colorCombinations: Array<{
    id: string;
    name: string;
    foreground: string;
    background: string;
    textSize?: 'normal' | 'large';
  }>;
  onValidationResults?: (results: Array<{ id: string; isValid: boolean; ratio: number }>) => void;
}

export function BulkContrastValidator({ colorCombinations, onValidationResults }: BulkContrastValidatorProps) {
  const [results, setResults] = useState<Array<{ id: string; isValid: boolean; ratio: number }>>([]);
  
  useEffect(() => {
    const validationResults = colorCombinations.map(combo => {
      const result = calculateContrast(combo.foreground, combo.background, combo.textSize === 'large');
      return {
        id: combo.id,
        isValid: result.isValidAA,
        ratio: result.ratio
      };
    });
    
    setResults(validationResults);
    
    if (onValidationResults) {
      onValidationResults(validationResults);
    }
  }, [colorCombinations, onValidationResults]);
  
  const passCount = results.filter(r => r.isValid).length;
  const totalCount = results.length;
  const passPercentage = totalCount > 0 ? (passCount / totalCount) * 100 : 0;
  
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h3" variant="headingSm">Accessibility Validation Results</Text>
        
        <InlineStack gap="400">
          <Box>
            <Text as="p" variant="bodySm" tone="subdued">Passed</Text>
            <Text as="p" variant="bodyMd" fontWeight="medium">
              {passCount} / {totalCount}
            </Text>
          </Box>
          <Box>
            <Text as="p" variant="bodySm" tone="subdued">Pass Rate</Text>
            <Text as="p" variant="bodyMd" fontWeight="medium">
              {passPercentage.toFixed(1)}%
            </Text>
          </Box>
        </InlineStack>
        
        <Badge 
          tone={passPercentage === 100 ? 'success' : passPercentage >= 80 ? 'warning' : 'critical'}
          size="small"
        >
          {passPercentage === 100 ? 'All combinations pass' : 
           passPercentage >= 80 ? 'Most combinations pass' : 
           'Some combinations fail'}
        </Badge>
        
        <BlockStack gap="200">
          {colorCombinations.map(combo => {
            const result = results.find(r => r.id === combo.id);
            return (
              <Box key={combo.id}>
                <InlineStack gap="200" align="space-between">
                  <Text as="p" variant="bodySm">{combo.name}</Text>
                  <ContrastValidator
                    foregroundColor={combo.foreground}
                    backgroundColor={combo.background}
                    textSize={combo.textSize}
                  />
                </InlineStack>
              </Box>
            );
          })}
        </BlockStack>
      </BlockStack>
    </Card>
  );
}

/**
 * Hook for automated contrast validation
 */
export function useContrastValidation() {
  const validateContrast = (foreground: string, background: string, isLargeText: boolean = false) => {
    return calculateContrast(foreground, background, isLargeText);
  };
  
  const validateColorPalette = (colors: Array<{ name: string; foreground: string; background: string; textSize?: 'normal' | 'large' }>) => {
    return colors.map(color => ({
      ...color,
      result: calculateContrast(color.foreground, color.background, color.textSize === 'large')
    }));
  };
  
  const generateAccessiblePalette = (baseColor: string) => {
    // Generate accessible color variations
    const base = hexToRgb(baseColor);
    if (!base) return [];
    
    const variations = [];
    // const white = [255, 255, 255] as [number, number, number];
    // const black = [0, 0, 0] as [number, number, number];
    
    // Test with white background
    const whiteResult = calculateContrast(baseColor, '#FFFFFF');
    if (whiteResult.isValidAA) {
      variations.push({
        name: 'On White Background',
        foreground: baseColor,
        background: '#FFFFFF',
        result: whiteResult
      });
    }
    
    // Test with black background
    const blackResult = calculateContrast(baseColor, '#000000');
    if (blackResult.isValidAA) {
      variations.push({
        name: 'On Black Background',
        foreground: baseColor,
        background: '#000000',
        result: blackResult
      });
    }
    
    return variations;
  };
  
  return {
    validateContrast,
    validateColorPalette,
    generateAccessiblePalette,
    colorContrast
  };
}

export default ContrastValidator;