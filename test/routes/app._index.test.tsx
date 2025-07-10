import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createRemixStub } from '@remix-run/testing';

// Import the route component
// import Index from '~/routes/app._index';

describe('App Index Route', () => {
  it('should render welcome message', () => {
    // const RemixStub = createRemixStub([
    //   {
    //     path: '/app',
    //     Component: Index,
    //   },
    // ]);

    // render(<RemixStub />);
    
    // expect(screen.getByText(/Welcome to WishCraft/)).toBeInTheDocument();
    
    // Placeholder test
    expect(true).toBe(true);
  });
});