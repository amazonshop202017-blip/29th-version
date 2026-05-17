import KellySimulator from '@/components/tools/KellySimulator';

export default function KellyCriterion() {
  return (
    <div className="app-container">
      <div className="max-w-container">
        <h1 className="main-title">Kelly Criterion Calculator</h1>
        <KellySimulator />
      </div>
    </div>
  );
}
