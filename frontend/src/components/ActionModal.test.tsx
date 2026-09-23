import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionModal } from './ActionModal';
import { signWithFreighter } from '@/lib/freighter';

vi.mock('@/lib/freighter', () => ({
  signWithFreighter: vi.fn(),
}));

const renderModal = (type: 'deposit' | 'withdraw' = 'deposit') => render(
  <ActionModal
    isOpen
    onClose={vi.fn()}
    type={type}
    userPublicKey="GUSER"
    balance={250}
    exchangeRate={1.25}
  />,
);

describe('ActionModal', () => {
  beforeEach(() => {
    vi.mocked(signWithFreighter).mockResolvedValue('signed-xdr');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('submits a deposit and renders the success state', async () => {
    renderModal('deposit');

    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '100' } });
    fireEvent.submit(screen.getByRole('button', { name: /confirm deposit/i }).closest('form')!);

    expect(screen.getByText(/signing with freighter/i)).toBeInTheDocument();

    expect(await screen.findByText(/deposit successful/i, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(signWithFreighter).toHaveBeenCalledWith('AAAAAgAAAAD...SorobanVaultTx...');
  });

  it('fills max amount for withdrawals', async () => {
    renderModal('withdraw');

    fireEvent.click(screen.getByRole('button', { name: /max/i }));

    expect(screen.getByPlaceholderText('0.00')).toHaveValue(250);
    expect(screen.getByText('200.0000 NV-SHARES')).toBeInTheDocument();
  });

  it('shows a transaction error when signing fails', async () => {
    vi.mocked(signWithFreighter).mockRejectedValue(new Error('rejected'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    renderModal('deposit');

    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '25' } });
    fireEvent.submit(screen.getByRole('button', { name: /confirm deposit/i }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Transaction failed. Please try again.');
    });
  });
});
