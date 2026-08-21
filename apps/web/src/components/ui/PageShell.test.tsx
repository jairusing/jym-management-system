// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PageShell } from './PageShell';

afterEach(() => {
  cleanup();
});

describe('PageShell', () => {
  it('renders grouped navigation sections with links', () => {
    render(
      <PageShell title="Test page">
        <p>Body content</p>
      </PageShell>
    );

    expect(screen.getAllByText('Home').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Account').length).toBeGreaterThan(0);

    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Profile' })).toBeTruthy();
  });

  it('renders no beta badge next to the page title', () => {
    render(
      <PageShell title="Test page">
        <p>Body content</p>
      </PageShell>
    );

    expect(screen.queryByText('Beta')).toBeNull();
  });

  it('marks the active page link', () => {
    window.history.pushState({}, '', '/profile');

    render(
      <PageShell title="Test page">
        <p>Body content</p>
      </PageShell>
    );

    const profile = screen.getByRole('link', { name: 'Profile' });
    expect(profile.getAttribute('aria-current')).toBe('page');
  });

  it('toggles the mobile menu', () => {
    render(
      <PageShell title="Test page">
        <p>Body content</p>
      </PageShell>
    );

    const menuButton = screen.getByRole('button', { name: 'Menu' });
    expect(menuButton.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(menuButton);
    expect(menuButton.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(menuButton.getAttribute('aria-expanded')).toBe('false');
  });

  it('renders no navigation when hideNav is set', () => {
    render(
      <PageShell title="Auth page" hideNav>
        <p>Body content</p>
      </PageShell>
    );

    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Menu' })).toBeNull();
  });
});
