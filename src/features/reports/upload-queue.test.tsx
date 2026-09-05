// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
const request = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api-client', () => ({ api: request }));
import { UploadQueue } from './upload-queue';

afterEach(() => { cleanup(); request.mockReset(); });
const report = { reportId: 'abc', patientId: 'patient-a', originalFilename: 'a.pdf', processingStatus: 'UPLOADED' };
describe('upload queue interactions', () => {
  it('continues other uploads after a failure and offers a retry', async () => {
    request.mockRejectedValueOnce(new Error('Temporary upload failure')).mockResolvedValueOnce({ report, duplicate: false }).mockResolvedValueOnce({ report, duplicate: false });
    const refreshed = vi.fn();
    render(<UploadQueue patientId="patient-a" onUploaded={refreshed} onView={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Choose reports'), { target: { files: [new File(['one'], 'one.pdf', { type: 'application/pdf' }), new File(['two'], 'two.pdf', { type: 'application/pdf' })] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload selected reports' }));
    await waitFor(() => expect(refreshed).toHaveBeenCalledOnce());
    expect(screen.getByText('Temporary upload failure')).toBeVisible();
    expect(request).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Retry upload' }));
    await waitFor(() => expect(refreshed).toHaveBeenCalledTimes(2));
    expect(request).toHaveBeenCalledTimes(3);
  });
  it('shows a duplicate notice and opens the existing report', async () => {
    request.mockResolvedValueOnce({ report, duplicate: true });
    const view = vi.fn();
    render(<UploadQueue patientId="patient-a" onUploaded={vi.fn()} onView={view} />);
    fireEvent.change(screen.getByLabelText('Choose reports'), { target: { files: [new File(['one'], 'a.pdf', { type: 'application/pdf' })] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload selected reports' }));
    fireEvent.click(await screen.findByRole('button', { name: 'View existing report' }));
    expect(view).toHaveBeenCalledWith(report);
    expect(screen.getByText('Already stored. No second copy was created.')).toBeVisible();
  });
  it('can cancel a pending upload without sending it', () => {
    render(<UploadQueue patientId="patient-a" onUploaded={vi.fn()} onView={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Choose reports'), { target: { files: [new File(['one'], 'cancel.pdf', { type: 'application/pdf' })] } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('cancel.pdf')).not.toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });
});
