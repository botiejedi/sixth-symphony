import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Onboarding } from './Onboarding.js';

describe('Onboarding', () => {
  it('calls onSave with correct workspace objects when labels are filled', async () => {
    const onSave = vi.fn();
    render(<Onboarding discoveredIds={[100, 200]} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText('Label for workspace 100'), {
      target: { value: 'Work' },
    });
    fireEvent.change(screen.getByLabelText('Label for workspace 200'), {
      target: { value: 'Reading' },
    });

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    // await a tick
    await Promise.resolve();

    expect(onSave).toHaveBeenCalledWith([
      { vivaldiWorkspaceId: 100, label: 'Work' },
      { vivaldiWorkspaceId: 200, label: 'Reading' },
    ]);
  });

  it('skips entries with empty or whitespace-only labels', async () => {
    const onSave = vi.fn();
    render(<Onboarding discoveredIds={[100, 200]} onSave={onSave} />);

    // Fill only one label; leave the other empty (default)
    fireEvent.change(screen.getByLabelText('Label for workspace 100'), {
      target: { value: 'Work' },
    });
    // workspace 200 label left empty

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await Promise.resolve();

    expect(onSave).toHaveBeenCalledWith([
      { vivaldiWorkspaceId: 100, label: 'Work' },
    ]);
  });

  it('skips entries with whitespace-only labels', async () => {
    const onSave = vi.fn();
    render(<Onboarding discoveredIds={[100, 200]} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText('Label for workspace 100'), {
      target: { value: '   ' },
    });
    fireEvent.change(screen.getByLabelText('Label for workspace 200'), {
      target: { value: 'Personal' },
    });

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await Promise.resolve();

    expect(onSave).toHaveBeenCalledWith([
      { vivaldiWorkspaceId: 200, label: 'Personal' },
    ]);
  });
});
