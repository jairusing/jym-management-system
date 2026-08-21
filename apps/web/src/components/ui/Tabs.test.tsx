// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Tabs } from './Tabs';

afterEach(() => {
  cleanup();
});

const tabs = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
  { id: 'c', label: 'Gamma' }
];

describe('Tabs', () => {
  it('selects tabs on click and marks the active one', () => {
    const onChange = vi.fn();
    render(<Tabs tabs={tabs} active="b" onChange={onChange} />);

    expect(screen.getByRole('tab', { name: 'Beta' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Beta' }).getAttribute('tabindex')).toBe('0');
    expect(screen.getByRole('tab', { name: 'Alpha' }).getAttribute('tabindex')).toBe('-1');

    fireEvent.click(screen.getByRole('tab', { name: 'Gamma' }));
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('moves selection and focus with arrow keys, wrapping at the ends', () => {
    const onChange = vi.fn();
    render(<Tabs tabs={tabs} active="b" onChange={onChange} />);

    const tablist = screen.getByRole('tablist');
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('c');

    fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith('a');

    fireEvent.keyDown(tablist, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('focus follows the arrow-key selection', () => {
    const onChange = vi.fn((id: string) => {
      // simulate the controlled parent updating `active`
      rerender(<Tabs tabs={tabs} active={id} onChange={onChange} />);
    });
    const { rerender } = render(<Tabs tabs={tabs} active="a" onChange={onChange} />);

    const tablist = screen.getByRole('tablist');
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Beta' }));
  });
});
