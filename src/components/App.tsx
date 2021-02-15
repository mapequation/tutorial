import React from 'react';
import './App.css';
import { modular_wd, modular_wd_json } from '../networks';
import { Network } from './network';
import { Network as NetworkModel } from '../model';
import { forceDirected } from '../layout';

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
    //const network = NetworkModel.deserialize(modular_wd);
    console.log(modular_wd_json);
    const network = NetworkModel.parse(modular_wd_json);

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
        {!loading && network != null && (
          <Network network={network} directed={true} />
        )}
      </div>
    );
  }
}

export default App;
