import { observer } from "mobx-react";
import { Network as NetworkModel, Rate } from "../model";
import Button from "./Button";

interface Props {
  network: NetworkModel;
  rate: Rate;
  showOptimized: boolean;
  onStartWalk: () => void;
  onToggleRate: () => void;
  onToggleSolution: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
}

/**
 * Observed control buttons that update when walker state changes.
 * Isolated to prevent Main component from re-rendering.
 */
const WalkerControls = observer(function WalkerControls({
  network,
  rate,
  showOptimized,
  onStartWalk,
  onToggleRate,
  onToggleSolution,
  speed,
  onSpeedChange,
}: Props) {
  const { walker } = network;

  return (
    <>
      <div className="flex flex-row justify-center space-x-4 mt-10 mb-10">
        <Button className="button" onClick={() => walker.reset()}>
          Reset
        </Button>
        <Button className="button" onClick={() => walker.step()}>
          Step
        </Button>
        <Button
          className={`button ${!walker.isStarted ? "button--primary" : ""}`}
          onClick={() => (walker.isStarted ? walker.stop() : onStartWalk())}
        >
          {walker.isStarted ? "Stop Random Walk" : "Start Random Walk"}
        </Button>
        <Button
          className={`button ${rate === Rate.Visits ? "button--primary" : ""}`}
          onClick={onToggleRate}
        >
          {rate === Rate.Visits ? "Hide visit rate" : "Show visit rate"}
        </Button>
        <Button className="button" onClick={onToggleSolution}>
          {showOptimized ? "Bad solution" : "Optimal solution"}
        </Button>
        <div className="flex flex-col items-center">
          <input
            type="range"
            id="walkerSpeed"
            min={1}
            max={10}
            step={1}
            value={speed}
            onChange={(e) => onSpeedChange(+e.target.value)}
          />
          <label htmlFor="walkerSpeed">{speed} steps per second</label>
        </div>
      </div>
    </>
  );
});

export default WalkerControls;
