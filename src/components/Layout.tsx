import React, { useState } from 'react';
import { Button, Grid, Header, Icon } from 'semantic-ui-react';
import type { Network as NetworkModel, Node } from '../model';
import Network from './Network';
import ToggleWalkButton from './ToggleWalkButton';
import RateView from './RateView';
import CodeView from './CodeView';
import { Rate } from '../model/enums';

export default function Layout(props: { network: NetworkModel }) {
  const { network } = props;

  const [rate, setRate] = useState(Rate.Flow);

  const step = () => {
    if (rate !== Rate.Visits) setRate(Rate.Visits);
    network.walker.step();
  };

  const getRate = (node: Node) => {
    if (rate === Rate.Visits) {
      return node.visitRate;
    } else if (rate === Rate.Votes) {
      return node.votes;
    }

    return node.flow;
  };

  const resetWalk = () => {
    setRate(Rate.Visits);
    network.walker.reset();
  };

  return (
    <Grid>
      <Grid.Column width={8}>
        <Network network={network} getRate={getRate} rate={rate} />
        <br />
        <Header>Random walker</Header>
        <Button onClick={resetWalk}>
          <Icon name="undo alternate" /> Reset
        </Button>
        <Button onClick={step} primary>
          <Icon name="step forward" />
          Step
        </Button>
        <ToggleWalkButton onClick={step} />
      </Grid.Column>
      <Grid.Column width={8}>
        <RateView
          network={network}
          getRate={getRate}
          rate={rate}
          setRate={setRate}
        />
        <CodeView network={network} />
      </Grid.Column>
    </Grid>
  );
}
