import { createBrowserRouter, createRoutesFromElements, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { rutas } from "@/core/routes/AppRoutes";

const queryClient = new QueryClient();
// Router de datos: hace falta para preguntar antes de salir de una pantalla con cambios sin guardar (useBlocker).
const router = createBrowserRouter(createRoutesFromElements(rutas));

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

export default App;
