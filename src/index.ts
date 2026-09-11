import { app } from './app';
import { config } from './config/env';

app.listen(config.port, () => {
  console.log(`[vitta] API escuchando en el puerto ${config.port}`);
});
