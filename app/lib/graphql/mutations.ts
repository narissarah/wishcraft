// GraphQL mutations for WishCraft app

export const CREATE_METAFIELD = `#graphql
  mutation createMetafield($metafield: MetafieldInput!) {
    metafieldSet(metafield: $metafield) {
      metafield {
        id
        namespace
        key
        value
        type
        description
        createdAt
        updatedAt
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const UPDATE_METAFIELD = `#graphql
  mutation updateMetafield($metafield: MetafieldInput!) {
    metafieldSet(metafield: $metafield) {
      metafield {
        id
        namespace
        key
        value
        type
        description
        createdAt
        updatedAt
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const DELETE_METAFIELD = `#graphql
  mutation deleteMetafield($input: MetafieldDeleteInput!) {
    metafieldDelete(input: $input) {
      deletedId
      userErrors {
        field
        message
      }
    }
  }
`;

export const CREATE_CUSTOMER = `#graphql
  mutation createCustomer($input: CustomerInput!) {
    customerCreate(input: $input) {
      customer {
        id
        email
        firstName
        lastName
        displayName
        phone
        state
        createdAt
        updatedAt
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const UPDATE_CUSTOMER = `#graphql
  mutation updateCustomer($input: CustomerInput!) {
    customerUpdate(input: $input) {
      customer {
        id
        email
        firstName
        lastName
        displayName
        phone
        state
        createdAt
        updatedAt
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const BULK_OPERATION_RUN_QUERY = `#graphql
  mutation bulkOperationRunQuery($query: String!) {
    bulkOperationRunQuery(query: $query) {
      bulkOperation {
        id
        status
        errorCode
        createdAt
        completedAt
        objectCount
        fileSize
        url
        partialDataUrl
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const CREATE_WEBHOOK = `#graphql
  mutation createWebhook($webhook: WebhookSubscriptionInput!) {
    webhookSubscriptionCreate(webhookSubscription: $webhook) {
      webhookSubscription {
        id
        callbackUrl
        topic
        format
        createdAt
        updatedAt
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const UPDATE_WEBHOOK = `#graphql
  mutation updateWebhook($id: ID!, $webhook: WebhookSubscriptionInput!) {
    webhookSubscriptionUpdate(id: $id, webhookSubscription: $webhook) {
      webhookSubscription {
        id
        callbackUrl
        topic
        format
        createdAt
        updatedAt
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const DELETE_WEBHOOK = `#graphql
  mutation deleteWebhook($id: ID!) {
    webhookSubscriptionDelete(id: $id) {
      deletedWebhookSubscriptionId
      userErrors {
        field
        message
      }
    }
  }
`;