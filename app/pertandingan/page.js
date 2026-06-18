import { Suspense } from 'react';
import PertandinganContent from './PertandinganContent';

export default function PertandinganPage() {
  return (
    <Suspense fallback={<div style={{ padding: '24px', textAlign: 'center' }}>Memuat...</div>}>
      <PertandinganContent />
    </Suspense>
  );
}