import React from 'react';
import './App.css';
import { modular_wd_json } from '../networks';
import { Network as NetworkModel } from '../model';
import Layout from './Layout';

interface AppProps {}

interface AppState {
  loading: boolean;
  network?: NetworkModel;
}

class App extends React.Component<AppProps> {
  state: AppState = {
    loading: true,
    network: undefined,
  };

  componentDidMount() {
    const network = NetworkModel.parse(modular_wd_json);
    network.flowCalculator.calculateFlow();

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
      <div className="App">
        {loading && <p>Loading...</p>}
        {!loading && network != null && <Layout network={network} />}
      </div>
    );
  }
}

export default App;
