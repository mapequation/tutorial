import React from 'react';
import { modular_wd_json } from '../networks';
import { Network } from '../model';
import Layout from './Layout';

interface AppProps {}

interface AppState {
  loading: boolean;
  network?: Network;
}

class App extends React.Component<AppProps> {
  state: AppState = {
    loading: true,
    network: undefined,
  };

  componentDidMount() {
    const network = Network.parse(modular_wd_json);
    network.flowCalculator.calculateFlow();
    network.tree.update();
    network.mapequation.calculateCodelength();
    network.coder.code();

    // TODO generalize and remove
    network.nodes.forEach((node) => {
      node.x *= 800;
      node.y *= 800;
    });

    this.setState({ loading: false, network });

    /*forceDirected(network, 600, 600).then(() =>
      this.setState({
        loading: false,
        network,
      }),
    );*/
  }

  render() {
    const { loading, network } = this.state;

    return (
      <>
        {loading && <p>Loading...</p>}
        {!loading && network != null && <Layout network={network} />}
      </>
    );
  }
}

export default App;
