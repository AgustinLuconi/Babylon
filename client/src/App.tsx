import { createBrowserRouter, createRoutesFromElements, RouterProvider } from "react-router-dom";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { alGuardarConExito } from "@/core/version/version";
import { rutas } from "@/core/routes/AppRoutes";

// Guardar algo con éxito, con una versión nueva publicada, exige recargar (core/version). Lo que corre solo en segundo
// plano (marcar un chat como leído) no cuenta como "guardar".
const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: (_datos, _variables, _contexto, mutacion) => {
      if (!mutacion.meta?.segundoPlano) alGuardarConExito();
    },
  }),
});
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
