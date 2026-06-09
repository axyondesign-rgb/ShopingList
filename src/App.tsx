import { useAppLogic } from './hooks/useAppLogic';
import { ShoppingAppUI } from './components/ShoppingAppUI';

export default function App() {
  const appLogic = useAppLogic();
  return <ShoppingAppUI {...appLogic} />;
}
