import RiskToRuinSimulator from '@/components/tools/RiskToRuinSimulator';

export default function RiskOfRuin() {
  return (
    <div className="app-container">
      <div className="max-w-container">
        <h1 className="main-title">Risk of Ruin Calculator</h1>
        <p style={{ color: '#a0a0a0', marginBottom: '2rem' }}>
          This calculator helps traders understand the probability of losing a specific percentage of their account based on their win rate, risk/reward ratio, and position sizing strategy.
        </p>
        <RiskToRuinSimulator />
      </div>
    </div>
  );
}
