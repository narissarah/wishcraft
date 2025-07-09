import type { LinksFunction, LoaderFunctionArgs, HeadersFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "@remix-run/react";
import { AppProvider } from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css";
import { generateResourceHints, generateCriticalCSS } from "~/lib/performance.server";
import { CriticalCSS, ResourceHints, PerformanceMonitor } from "~/components/PerformanceOptimized";
import { getSecurityHeaders, generateNonce, getCSPMetaTag } from "~/lib/security-headers.server";
import { rateLimitMiddleware, RATE_LIMITS } from "~/lib/rate-limiter.server";
import { ThemeProvider } from "~/components/ThemeProvider";
import { useEffect } from "react";

export const links: LinksFunction = () => {
  return [
    // Critical CSS will be inlined, so load Polaris with lower priority
    { 
      rel: "preload", 
      href: "/build/polaris.css", 
      as: "style",
      onload: "this.onload=null;this.rel='stylesheet'"
    },
    // Preconnect to critical domains
    { rel: "preconnect", href: "https://cdn.shopify.com" },
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
    // DNS prefetch for analytics
    { rel: "dns-prefetch", href: "https://www.google-analytics.com" },
    { rel: "dns-prefetch", href: "https://analytics.google.com" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimitMiddleware(RATE_LIMITS.public)(request);
  if (rateLimitResponse && rateLimitResponse.status === 429) {
    throw rateLimitResponse;
  }
  
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // Generate CSP nonce for this request
  const nonce = generateNonce();
  
  return json({
    resourceHints: generateResourceHints(),
    criticalCSS: generateCriticalCSS(pathname),
    pathname,
    nonce,
    ENV: {
      NODE_ENV: process.env.NODE_ENV,
      GA_MEASUREMENT_ID: process.env.GA_MEASUREMENT_ID,
      SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL,
    }
  }, {
    headers: rateLimitResponse?.headers || {}
  });
}

// Apply security headers to all responses
export const headers: HeadersFunction = ({ loaderHeaders, parentHeaders }) => {
  const headers = new Headers(parentHeaders);
  
  // Copy loader headers (for rate limiting)
  loaderHeaders.forEach((value, key) => {
    headers.set(key, value);
  });
  
  // Apply security headers
  const securityHeaders = getSecurityHeaders(new Request("https://wishcraft.app"));
  Object.entries(securityHeaders).forEach(([key, value]) => {
    if (value) headers.set(key, value);
  });
  
  return headers;
};

export default function App() {
  const { resourceHints, criticalCSS, ENV, nonce } = useLoaderData<typeof loader>();

  // Initialize Core Web Vitals monitoring on client
  useEffect(() => {
    if (typeof window !== "undefined") {
      import("~/lib/web-vitals.client").then(({ initWebVitals }) => {
        initWebVitals();
      });
    }
  }, []);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        
        {/* Security headers via meta tags */}
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        
        {/* Performance optimizations */}
        <meta name="theme-color" content="#000000" />
        <meta name="color-scheme" content="light dark" />
        
        {/* Resource hints for performance */}
        <ResourceHints hints={resourceHints} />
        
        {/* Critical CSS inlined for faster rendering */}
        <CriticalCSS styles={criticalCSS} />
        
        <Meta />
        <Links />
        
        {/* Preload critical resources */}
        <link rel="preload" href="/build/entry.client.js" as="script" />
        
        {/* Google Analytics (if configured) with nonce */}
        {ENV.GA_MEASUREMENT_ID && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${ENV.GA_MEASUREMENT_ID}`}
            />
            <script
              nonce={nonce}
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${ENV.GA_MEASUREMENT_ID}', {
                    page_title: document.title,
                    page_location: window.location.href,
                    send_page_view: false,
                    cookie_flags: 'secure;samesite=strict'
                  });
                `,
              }}
            />
          </>
        )}
      </head>
      <body>
        <ThemeProvider>
          <AppProvider 
            i18n={{
              Polaris: {
                Avatar: {
                  label: 'Avatar',
                  labelWithInitials: 'Avatar with initials {initials}',
                },
                ContextualSaveBar: {
                  save: 'Save',
                  discard: 'Discard',
                },
                TextField: {
                  characterCount: '{count} characters',
                },
                TopBar: {
                  toggleMenuLabel: 'Toggle menu',
                  SearchField: {
                    clearButtonLabel: 'Clear',
                    search: 'Search',
                  },
                },
                Modal: {
                  iFrameTitle: 'body markup',
                  modalWarning: 'These required properties are missing from Modal: {missingProps}',
                },
                Frame: {
                  skipToContent: 'Skip to content',
                  navigationLabel: 'Navigation',
                  Navigation: {
                    closeMobileNavigationLabel: 'Close navigation',
                  },
                },
                ActionList: {
                  SearchField: {
                    clearButtonLabel: 'Clear',
                    search: 'Search',
                    placeholder: 'Search actions',
                  },
                },
                Button: {
                  spinnerAccessibilityLabel: 'Loading',
                  connectedDisclosure: 'Additional actions',
                },
                Common: {
                  checkbox: 'checkbox',
                  undo: 'Undo',
                  cancel: 'Cancel',
                  clear: 'Clear',
                  close: 'Close',
                  submit: 'Submit',
                  more: 'More',
                },
                FormLayout: {
                  FormLayoutGroup: {
                    helpText: 'Help text',
                  },
                },
                Page: {
                  Header: {
                    rollupActionsLabel: 'Actions',
                    pageReadyAccessibilityLabel: 'Page loaded',
                  },
                },
                Pagination: {
                  previous: 'Previous',
                  next: 'Next',
                  pagination: 'Pagination',
                },
                ProgressBar: {
                  label: 'Progress of {progress}%',
                },
                ResourceList: {
                  sortingLabel: 'Sort by',
                  defaultItemSingular: 'item',
                  defaultItemPlural: 'items',
                  showing: 'Showing {itemsCount} {resource}',
                  Item: {
                    actionsDropdownLabel: 'Actions',
                    actionsDropdown: 'Actions dropdown',
                    viewItem: 'View details for {itemName}',
                  },
                  BulkActions: {
                    actionsActivatorLabel: 'Actions',
                    moreActionsActivatorLabel: 'More actions',
                    tapToSelectAll: 'Tap to select all',
                    selectAll: 'Select all',
                    selectAllInStore: 'Select all in store',
                    deselectAll: 'Deselect all',
                    selectAllItems: 'Select all {itemsLength} items',
                    selectAllItemsInStore: 'Select all items in store',
                    deselectAllItems: 'Deselect all {itemsLength} items',
                    partiallySelectedWarning: 'Only {selectedItemsCount} of {itemsLength} items are selected',
                    aria: {
                      bulkActionsLabel: 'Bulk actions',
                      bulkActionsInstructionsWithSingleSelection: 'Select items to use bulk actions',
                      bulkActionsInstructionsWithMultipleSelections: 'Select items to use bulk actions',
                    },
                  },
                },
                SkeletonPage: {
                  loadingLabel: 'Page loading',
                },
                Spinner: {
                  warningMessage: 'Missing accessibility label',
                },
                Tabs: {
                  newViewAccessibilityLabel: 'New view',
                  toggleTabsLabel: 'More tabs',
                },
                Toast: {
                  dismissLabel: 'Dismiss notification',
                },
                Tooltip: {
                  dismissLabel: 'Dismiss tooltip',
                },
                DataTable: {
                  columnVisibilityButtonLabel: 'Customize table',
                  editColumnVisibilityButtonLabel: 'Edit columns',
                  sortAccessibilityLabel: 'sort {direction} by {content}',
                  sortKeyAccessibilityLabel: 'sort {content}',
                  navAccessibilityLabel: 'Scroll table right',
                  totalsRowHeading: 'Total',
                  totalRowHeading: 'Total',
                },
                DatePicker: {
                  previousMonth: 'Previous month',
                  nextMonth: 'Next month',
                  today: 'Today',
                  start: 'Start',
                  end: 'End',
                  months: {
                    January: 'January',
                    February: 'February',
                    March: 'March',
                    April: 'April',
                    May: 'May',
                    June: 'June',
                    July: 'July',
                    August: 'August',
                    September: 'September',
                    October: 'October',
                    November: 'November',
                    December: 'December',
                  },
                  daysAbbreviated: {
                    Monday: 'Mon',
                    Tuesday: 'Tue',
                    Wednesday: 'Wed',
                    Thursday: 'Thu',
                    Friday: 'Fri',
                    Saturday: 'Sat',
                    Sunday: 'Sun',
                  },
                },
                DropZone: {
                  single: {
                    overlayTextFile: 'Drop file to upload',
                    overlayTextImage: 'Drop image to upload',
                    overlayTextVideo: 'Drop video to upload',
                    actionTitleFile: 'Add file',
                    actionTitleImage: 'Add image',
                    actionTitleVideo: 'Add video',
                    actionHintFile: 'or drop files to upload',
                    actionHintImage: 'or drop images to upload',
                    actionHintVideo: 'or drop videos to upload',
                    labelFile: 'Upload file',
                    labelImage: 'Upload image',
                    labelVideo: 'Upload video',
                  },
                  allowMultiple: {
                    overlayTextFile: 'Drop files to upload',
                    overlayTextImage: 'Drop images to upload',
                    overlayTextVideo: 'Drop videos to upload',
                    actionTitleFile: 'Add files',
                    actionTitleImage: 'Add images',
                    actionTitleVideo: 'Add videos',
                    actionHintFile: 'or drop files to upload',
                    actionHintImage: 'or drop images to upload',
                    actionHintVideo: 'or drop videos to upload',
                    labelFile: 'Upload files',
                    labelImage: 'Upload images',
                    labelVideo: 'Upload videos',
                  },
                  errorOverlayTextFile: 'File type is not valid',
                  errorOverlayTextImage: 'Image type is not valid',
                  errorOverlayTextVideo: 'Video type is not valid',
                },
                EmptyState: {
                  heading: 'Manage your inventory transfers',
                },
                IndexTable: {
                  emptySearchTitle: 'No results found',
                  emptySearchDescription: 'Try changing the filters or search term',
                  onboardingBadgeText: 'New',
                  resourceName: {
                    singular: 'item',
                    plural: 'items',
                  },
                  selectedItemsCount: '{selectedItemsCount} selected',
                  selectAllItems: 'Select all {itemsLength} items',
                  selectAllItemsInStore: 'Select all items in store',
                  selectItem: 'Select item',
                  deselectAllItems: 'Deselect all {itemsLength} items',
                  sort: 'Sort',
                  undo: 'Undo',
                  selectAllLabel: 'Select all',
                  actionsLabel: 'Actions',
                  selected: 'selected',
                  duplicate: 'Duplicate',
                  delete: 'Delete',
                  unpublished: 'Unpublished',
                  published: 'Published',
                  draft: 'Draft',
                  readyToShip: 'Ready to ship',
                  unfulfilled: 'Unfulfilled',
                  partiallyFulfilled: 'Partially fulfilled',
                  fulfilled: 'Fulfilled',
                  onHold: 'On hold',
                  approved: 'Approved',
                  declined: 'Declined',
                  pending: 'Pending',
                  markAsPaid: 'Mark as paid',
                  markAsUnpaid: 'Mark as unpaid',
                  paidStatus: 'Paid status',
                  authorized: 'Authorized',
                  captured: 'Captured',
                  voided: 'Voided',
                  refunded: 'Refunded',
                  partiallyRefunded: 'Partially refunded',
                  chargeback: 'Chargeback',
                  disputeWon: 'Dispute won',
                  disputeLost: 'Dispute lost',
                  manuallyResolved: 'Manually resolved',
                  cancelled: 'Cancelled',
                  active: 'Active',
                  expired: 'Expired',
                  scheduled: 'Scheduled',
                  soldOut: 'Sold out',
                  partiallyAvailable: 'Partially available',
                  available: 'Available',
                  unavailable: 'Unavailable',
                  processing: 'Processing',
                  dialed: 'Dialed',
                  busy: 'Busy',
                  noAnswer: 'No answer',
                  failed: 'Failed',
                  completed: 'Completed',
                  redacted: 'Redacted',
                  requiresAction: 'Requires action',
                  new: 'New',
                  open: 'Open',
                  inProgress: 'In progress',
                  onHoldSecond: 'On hold',
                  closed: 'Closed',
                  resolved: 'Resolved',
                  reopened: 'Reopened',
                  notStarted: 'Not started',
                  started: 'Started',
                  finished: 'Finished',
                  overdue: 'Overdue',
                  upcoming: 'Upcoming',
                  today: 'Today',
                },
                Loading: {
                  label: 'Page loading bar',
                },
                Filters: {
                  moreFilters: 'More filters',
                  filter: 'Filter',
                  noFiltersApplied: 'No filters applied',
                  cancel: 'Cancel',
                  done: 'Done',
                  clearAllFilters: 'Clear all filters',
                  clear: 'Clear',
                  clearFilter: 'Clear {filterName}',
                  addFilter: 'Add filter',
                  clearFilters: 'Clear all',
                  searchInSection: 'Search in {sectionName}',
                  chooseDate: 'Choose date',
                  selectDate: 'Select date',
                  calendarLabel: 'Calendar',
                  rangeDateLabel: 'Date range',
                  DateFilterLabel: 'Date filter',
                  after: 'After',
                  before: 'Before',
                  filterByDate: 'Filter by date',
                  selectDateRange: 'Select date range',
                  selectFilterDate: 'Select filter date',
                  StartDateLabel: 'Start date',
                  EndDateLabel: 'End date',
                  monthPickerLabel: 'Month',
                  yearPickerLabel: 'Year',
                  cancelButtonLabel: 'Cancel',
                  applyButtonLabel: 'Apply',
                  clearButtonLabel: 'Clear',
                  editButtonLabel: 'Edit',
                  doneButtonLabel: 'Done',
                  hideButtonLabel: 'Hide',
                  showButtonLabel: 'Show',
                  clearAllButtonLabel: 'Clear all',
                  textFieldLabel: 'Filter',
                  chooseFiltersLabel: 'Choose filters',
                  selectAllLabel: 'Select all',
                  deselectAllLabel: 'Deselect all',
                  allFilterLabel: 'All',
                  anyFilterLabel: 'Any',
                  noneFilterLabel: 'None',
                  enabledFilterLabel: 'Enabled',
                  disabledFilterLabel: 'Disabled',
                  onFilterLabel: 'On',
                  offFilterLabel: 'Off',
                  yesFilterLabel: 'Yes',
                  noFilterLabel: 'No',
                  trueFilterLabel: 'True',
                  falseFilterLabel: 'False',
                  activeFilterLabel: 'Active',
                  inactiveFilterLabel: 'Inactive',
                  archivedFilterLabel: 'Archived',
                  unarchivedFilterLabel: 'Unarchived',
                  visibleFilterLabel: 'Visible',
                  hiddenFilterLabel: 'Hidden',
                  publishedFilterLabel: 'Published',
                  unpublishedFilterLabel: 'Unpublished',
                  availableFilterLabel: 'Available',
                  unavailableFilterLabel: 'Unavailable',
                  completedFilterLabel: 'Completed',
                  pendingFilterLabel: 'Pending',
                  cancelledFilterLabel: 'Cancelled',
                  refundedFilterLabel: 'Refunded',
                  partiallyRefundedFilterLabel: 'Partially refunded',
                  fulfilledFilterLabel: 'Fulfilled',
                  partiallyFulfilledFilterLabel: 'Partially fulfilled',
                  unfulfilledFilterLabel: 'Unfulfilled',
                  paidFilterLabel: 'Paid',
                  unpaidFilterLabel: 'Unpaid',
                  overdue: 'Overdue',
                  authorizedFilterLabel: 'Authorized',
                  capturedFilterLabel: 'Captured',
                  declinedFilterLabel: 'Declined',
                  expiredFilterLabel: 'Expired',
                  voidedFilterLabel: 'Voided',
                  processingFilterLabel: 'Processing',
                  failedFilterLabel: 'Failed',
                  successFilterLabel: 'Success',
                  openFilterLabel: 'Open',
                  closedFilterLabel: 'Closed',
                  highFilterLabel: 'High',
                  mediumFilterLabel: 'Medium',
                  lowFilterLabel: 'Low',
                  normalFilterLabel: 'Normal',
                  urgentFilterLabel: 'Urgent',
                  newFilterLabel: 'New',
                  inProgressFilterLabel: 'In progress',
                  onHoldFilterLabel: 'On hold',
                  resolvedFilterLabel: 'Resolved',
                  reopenedFilterLabel: 'Reopened',
                  unknownFilterLabel: 'Unknown',
                  draft: 'Draft',
                  scheduled: 'Scheduled',
                  inReview: 'In review',
                  approved: 'Approved',
                  rejected: 'Rejected',
                  live: 'Live',
                  ended: 'Ended',
                  paused: 'Paused',
                  notStarted: 'Not started',
                  started: 'Started',
                  finished: 'Finished',
                  today: 'Today',
                  yesterday: 'Yesterday',
                  lastWeek: 'Last week',
                  lastMonth: 'Last month',
                  lastYear: 'Last year',
                  comingSoon: 'Coming soon',
                  filterByKeyword: 'Filter by keyword',
                  selectOption: 'Select option',
                  chooseDateSecond: 'Choose date',
                  selectDateSecond: 'Select date',
                  selectAll: 'Select all',
                  deselectAll: 'Deselect all',
                  searchPlaceholder: 'Search',
                  searchResults: 'Search results',
                  noResults: 'No results',
                  noResultsFor: 'No results for "{searchTerm}"',
                  showingResults: 'Showing {count} of {total} results',
                  showingAllResults: 'Showing all {total} results',
                  loadingResults: 'Loading results...',
                  errorLoadingResults: 'Error loading results',
                  tryAgain: 'Try again',
                  retry: 'Retry',
                  filterResults: 'Filter results',
                  clearSearch: 'Clear search',
                  searchFilterLabel: 'Search filter',
                  searchFilterPlaceholder: 'Search filters',
                  clearSearchFilter: 'Clear search filter',
                  searchFilterResults: 'Search filter results',
                  noSearchFilterResults: 'No search filter results',
                  searchFilterResultsFor: 'Search filter results for "{searchTerm}"',
                  showingSearchFilterResults: 'Showing {count} of {total} search filter results',
                  showingAllSearchFilterResults: 'Showing all {total} search filter results',
                  loadingSearchFilterResults: 'Loading search filter results...',
                  errorLoadingSearchFilterResults: 'Error loading search filter results',
                  searchFilterTryAgain: 'Search filter try again',
                  searchFilterRetry: 'Search filter retry'
                },
                TextFieldSecond: {
                  characterCount: '{count} of {limit} characters used',
                  characterCountWithoutLimit: '{count} characters',
                },
                Navigation: {
                  closeMobileNavigationLabel: 'Close navigation',
                },
                FooterHelp: {
                  suggestedText: 'Suggested:',
                },
                PickerColorPicker: {
                  hueSliderLabel: 'Hue slider',
                  alphaSliderLabel: 'Opacity slider',
                  colorTextFieldLabel: 'Color value',
                }
              }
            }}
            features={{ 
              newDesignLanguage: true,
              unstableGlobalTheming: true 
            }}
          >
            <ApplicationErrorBoundary>
              <Outlet />
            </ApplicationErrorBoundary>
          </AppProvider>
        </ThemeProvider>
        
        {/* Performance monitoring */}
        <PerformanceMonitor />
        
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
        
        {/* Service Worker registration with nonce */}
        {ENV.NODE_ENV === 'production' && (
          <script
            nonce={nonce}
            dangerouslySetInnerHTML={{
              __html: `
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.register('/sw.js', {
                    updateViaCache: 'none'
                  })
                    .then(registration => {
                      console.log('SW registered');
                      // Check for updates every hour
                      setInterval(() => registration.update(), 3600000);
                    })
                    .catch(error => console.log('SW registration failed'));
                }
              `,
            }}
          />
        )}
        
        {/* Performance monitoring initialization */}
        <script 
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `
              // Initialize performance monitoring
              if (window.performance && performance.mark) {
                performance.mark('app-interactive');
              }
            `,
          }}
        />
        
        {/* Environment variables for client */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `window.ENV = ${JSON.stringify(ENV)};`,
          }}
        />
      </body>
    </html>
  );
}