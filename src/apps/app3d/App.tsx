import { AppProvider } from './store/AppContext';
import { MainLayout } from './layout/MainLayout';

function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  )
}

export default App
