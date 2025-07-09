// GraphQL queries for WishCraft app

export const GET_SHOP_INFO = `#graphql
  query getShopInfo {
    shop {
      id
      name
      email
      myshopifyDomain
      currencyCode
      timezone
    }
  }
`;

export const GET_PRODUCTS = `#graphql
  query getProducts($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query) {
      edges {
        node {
          id
          title
          handle
          description
          status
          images(first: 1) {
            edges {
              node {
                id
                url
                altText
              }
            }
          }
          variants(first: 10) {
            edges {
              node {
                id
                title
                price
                compareAtPrice
                availableForSale
                inventoryQuantity
                sku
              }
            }
          }
          tags
          createdAt
          updatedAt
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const GET_PRODUCT_BY_ID = `#graphql
  query getProductById($id: ID!) {
    product(id: $id) {
      id
      title
      handle
      description
      status
      images(first: 5) {
        edges {
          node {
            id
            url
            altText
          }
        }
      }
      variants(first: 100) {
        edges {
          node {
            id
            title
            price
            compareAtPrice
            availableForSale
            inventoryQuantity
            sku
            selectedOptions {
              name
              value
            }
          }
        }
      }
      options {
        id
        name
        values
      }
      tags
      createdAt
      updatedAt
    }
  }
`;

export const GET_CUSTOMERS = `#graphql
  query getCustomers($first: Int!, $after: String, $query: String) {
    customers(first: $first, after: $after, query: $query) {
      edges {
        node {
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
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const GET_CUSTOMER_BY_ID = `#graphql
  query getCustomerById($id: ID!) {
    customer(id: $id) {
      id
      email
      firstName
      lastName
      displayName
      phone
      state
      addresses {
        id
        address1
        address2
        city
        province
        zip
        country
        firstName
        lastName
        company
      }
      createdAt
      updatedAt
    }
  }
`;

export const GET_ORDERS = `#graphql
  query getOrders($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, query: $query) {
      edges {
        node {
          id
          name
          email
          totalPrice
          subtotalPrice
          totalTax
          currencyCode
          fulfillmentStatus
          financialStatus
          customer {
            id
            email
            firstName
            lastName
          }
          lineItems(first: 10) {
            edges {
              node {
                id
                title
                quantity
                price
                product {
                  id
                  handle
                }
                variant {
                  id
                  title
                }
              }
            }
          }
          createdAt
          updatedAt
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const GET_METAFIELDS = `#graphql
  query getMetafields($ownerId: ID!, $first: Int!) {
    metafields(ownerId: $ownerId, first: $first) {
      edges {
        node {
          id
          namespace
          key
          value
          type
          description
          createdAt
          updatedAt
        }
      }
    }
  }
`;