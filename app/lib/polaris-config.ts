/**
 * Polaris i18n configuration
 * Extracted from root.tsx to reduce file size
 */

export const polarisI18n = {
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
      progressLabel: 'Progress',
    },
    ResourceList: {
      sortingLabel: 'Sort by',
      defaultItemSingular: 'item',
      defaultItemPlural: 'items',
      showing: 'Showing {itemsCount} {resource}',
      defaultHeaderTitle: 'Items',
      allItemsSelected: 'All {itemsCount}+ items in your store are selected.',
      selected: '{selectedItemsCount} selected',
      a11yCheckboxDeselectAllSingle: 'Deselect item',
      a11yCheckboxSelectAllSingle: 'Select item',
      a11yCheckboxDeselectAllMultiple: 'Deselect all {itemsCount} items',
      a11yCheckboxSelectAllMultiple: 'Select all {itemsCount} items',
      Item: {
        actionsDropdownLabel: 'Actions for {accessibilityLabel}',
        actionsDropdown: 'Actions dropdown',
        viewItem: 'View details for {itemName}',
      },
      BulkActions: {
        actionsActivatorLabel: 'Actions',
        moreActionsActivatorLabel: 'More actions',
        warningMessage: 'To provide a better user experience, bulk actions should have fewer than {maxActions} actions.',
      },
      FilterCreator: {
        filterButtonLabel: 'Filter',
        selectFilterKeyPlaceholder: 'Select a filter...',
        addFilterButtonLabel: 'Add filter',
        showAllWhere: 'Show all {resourceNamePlural} where:',
      },
      FilterControl: {
        textFieldLabel: 'Search {resourceNamePlural}',
      },
    },
    DataTable: {
      columnVisibilityButtonLabel: 'Customize table',
      navAccessibilityLabel: 'Data table navigation',
      totalsRowHeading: 'Totals',
      totalRowHeading: 'Total',
    },
    DatePicker: {
      previousMonth: 'Show previous month, {previousMonthName} {showPreviousYear}',
      nextMonth: 'Show next month, {nextMonthName} {nextYear}',
      today: 'Today ',
      start: 'Start of range',
      end: 'End of range',
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
      days: {
        Monday: 'Monday',
        Tuesday: 'Tuesday', 
        Wednesday: 'Wednesday',
        Thursday: 'Thursday',
        Friday: 'Friday',
        Saturday: 'Saturday',
        Sunday: 'Sunday',
      },
      daysAbbreviated: {
        Monday: 'Mo',
        Tuesday: 'Tu',
        Wednesday: 'We', 
        Thursday: 'Th',
        Friday: 'Fr',
        Saturday: 'Sa',
        Sunday: 'Su',
      },
    },
    DropZone: {
      overlayTextFile: 'Drop file to upload',
      overlayTextImage: 'Drop image to upload',
      errorOverlayTextFile: 'This file type is not supported',
      errorOverlayTextImage: 'This image type is not supported',
      FileUpload: {
        actionTitleFile: 'Add file',
        actionTitleImage: 'Add image',
        actionHintFile: 'or drop file to upload',
        actionHintImage: 'or drop image to upload',
        label: 'Upload file',
      },
    },
    EmptyState: {
      altText: 'Empty state',
    },
    IndexTable: {
      emptySearchTitle: 'No {resourceNamePlural} found',
      emptySearchDescription: 'Try changing the filters or search term',
      onboardingBadgeText: 'New',
      resourceLoadingAccessibilityLabel: 'Loading {resourceNamePlural}',
      selected: '{selectedItemsCount} selected',
      undo: 'Undo',
      selectAllLabel: 'Select all {resourceNamePlural}',
      a11yCheckboxDeselectAllSingle: 'Deselect {resourceNameSingular}',
      a11yCheckboxSelectAllSingle: 'Select {resourceNameSingular}', 
      a11yCheckboxDeselectAllMultiple: 'Deselect all {itemsCount} {resourceNamePlural}',
      a11yCheckboxSelectAllMultiple: 'Select all {itemsCount} {resourceNamePlural}',
      actionsDropdownLabel: 'Actions for {accessibilityLabel}',
      actionsDropdown: 'Actions dropdown',
      selectItem: 'Select {resourceName}',
      selectButtonText: 'Select',
      sortAccessibilityLabel: 'sort {direction} by',
      sortKeyAccessibilityLabel: 'sort by {columnName}',
      BulkActions: {
        actionsActivatorLabel: 'Actions',
        moreActionsActivatorLabel: 'More actions',
        warningMessage: 'To provide a better user experience, bulk actions should have fewer than {maxActions} actions.',
      },
    },
    Loading: {
      label: 'Page loading bar',
    },
    Navigation: {
      closeMobileNavigationLabel: 'Close navigation',
      TooltipContent: 'Tooltip',
    },
    OptionList: {
      searchResultsLabel: 'Search results',
      noResultsFound: 'No results found',
    },
    Popover: {
      dismissLabel: 'Dismiss',
    },
    ResourceItem: {
      actionsDropdownLabel: 'Actions for {accessibilityLabel}',
      actionsDropdown: 'Actions dropdown',
      selectItem: 'Select {accessibilityLabel}',
      deselectItem: 'Deselect {accessibilityLabel}',
    },
    SearchField: {
      clearButtonLabel: 'Clear',
      search: 'Search',
    },
    Select: {
      noOptionsText: 'No options available',
      placeholder: 'Select...',
    },
    SkeletonPage: {
      loadingLabel: 'Page loading',
    },
    Spinner: {
      warningMessage: 'The color {color} is not meant to be used on {surface} surface. The color {color} should only be used on {useOn}',
    },
    Tabs: {
      toggleTabsLabel: 'More tabs',
    },
    Tag: {
      ariaLabel: 'Remove {children}',
    },
    Toast: {
      dismissToast: 'Dismiss notification',
    },
    Tooltip: {
      activatorWarningMessage: 'The activator component passed to Tooltip props expects to receive focus events.',
    }
  }
};