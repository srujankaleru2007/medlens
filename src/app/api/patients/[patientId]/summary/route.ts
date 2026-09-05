import { NextResponse } from 'next/server';
import { authenticated, endpoint, HttpError, rateLimit } from '@/lib/server/http';
import { ownedPatient } from '@/lib/server/patients';
import { database } from '@/lib/server/firebase';
import { GeminiProvider, fallbackSummary, type SummaryContext } from '@/features/intelligence/ai-provider';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
export async function POST(request: Request, context: { params: Promise<{ patientId: string }> }) { return endpoint(async () => {
  const { patientId } = await context.params; const uid = await authenticated(request); await rateLimit(uid, 'summary-generation', 10); const patient = await ownedPatient(uid, patientId);
  const snapshot = await database().collection('patients').doc(patientId).collection('reports').get();
  const reports = snapshot.docs.map(doc => doc.data()).filter(item => item.ownerId === uid);
  const extractions = await Promise.all(reports.map(async report => (await database().collection('patients').doc(patientId).collection('reports').doc(report.reportId).collection('extractions').get()).docs.map(doc => doc.data())));
  const contextData: SummaryContext = { profile: { name: patient.displayName, symptoms: patient.symptoms, conditions: patient.conditions, allergies: patient.allergies, medications: patient.medications }, reports: reports.map(item => ({ name: item.originalFilename, date: item.uploadedAt, type: item.processingStatus, status: item.processingStatus })), observations: extractions.flat().flatMap(item => item.status === 'DRAFT' ? (item.observations ?? []).filter((observation: { confidence: string }) => observation.confidence === 'HIGH' || observation.confidence === 'MODERATE').map((observation: { testName: string; textualValue: string; unit?: string; referenceRangeText?: string; confidence: string; provenance: { reportId: string } }) => ({ test: observation.testName, value: observation.textualValue, unit: observation.unit, range: observation.referenceRangeText, confidence: observation.confidence, source: observation.provenance.reportId })) : []), uncertainties: reports.filter(item => item.processingStatus !== 'VERIFIED').map(item => `${item.originalFilename} is ${item.processingStatus} and may need human review.`) };
  let summary; try { summary = await new GeminiProvider().summarize(contextData); } catch (error) { if (error instanceof HttpError) throw error; summary = fallbackSummary(contextData); }
  return NextResponse.json({ summary, transparency: { label: 'AI GENERATED', generatedAt: new Date().toISOString(), verifiedInputsOnly: false, limitations: 'Informational only. Review source evidence and unresolved uncertainties with a qualified clinician.' } });
}); }
