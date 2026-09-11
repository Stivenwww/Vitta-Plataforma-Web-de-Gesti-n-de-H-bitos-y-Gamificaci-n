🌱 HÁBITOS+ — Dashboard Gamificado de Hábitos Saludables

Convierte tus hábitos diarios en progreso visible.

HÁBITOS+ es una aplicación web diseñada para ayudar a las personas a registrar, monitorear y visualizar sus hábitos saludables, utilizando mecánicas de gamificación como puntos, rachas y logros.

El proyecto busca transformar el seguimiento tradicional de hábitos en una experiencia visual, sencilla y motivadora, permitiendo que el usuario vea de manera inmediata cómo avanza hacia sus objetivos.

📌 Descripción del proyecto

En la vida universitaria y laboral, mantener hábitos como dormir adecuadamente, estudiar, hacer ejercicio, hidratarse o leer puede resultar difícil debido a las múltiples responsabilidades diarias.

HÁBITOS+ propone una solución mediante un ciclo sencillo:

Configurar → Registrar → Cumplir → Obtener puntos → Mantener rachas → Desbloquear logros → Visualizar progreso

El sistema permite que cada usuario configure sus propios hábitos y registre diariamente su cumplimiento. La información se transforma en indicadores visuales que permiten comprender la evolución y mantener la motivación.

🎯 Objetivo general

Desarrollar una aplicación web que permita a los usuarios registrar, monitorear y visualizar el cumplimiento de sus hábitos saludables diarios, incorporando mecanismos de gamificación que incentiven la constancia y el compromiso personal.

🚀 Objetivos específicos
Diseñar un modelo de datos simple y escalable.
Permitir el registro y seguimiento diario de hábitos.
Implementar un sistema de puntos.
Calcular y visualizar rachas de cumplimiento.
Crear un catálogo de logros desbloqueables.
Mostrar el progreso mediante gráficas.
Implementar un mapa de calor tipo calendario.
Mostrar puntos, nivel y racha activa.
Facilitar el registro de hábitos mediante una interfaz sencilla.
Mantener una experiencia responsive para diferentes dispositivos.
✨ Funcionalidades principales
🔐 Autenticación

El usuario podrá:

Crear una cuenta.
Iniciar sesión.
Acceder de forma segura a su información.
Utilizar rutas protegidas.
Mantener una sesión mediante token JWT.

La autenticación contempla validaciones de campos, manejo de errores y protección de la información del usuario.

📝 Configuración de hábitos

El usuario podrá seleccionar hábitos predefinidos o crear hábitos personalizados.

Hábitos predefinidos

Entre los ejemplos contemplados se encuentran:

😴 Dormir
📚 Estudiar
🏃 Hacer ejercicio
💧 Tomar agua
📖 Leer

También será posible crear un hábito propio indicando:

Nombre.
Meta.
Frecuencia.

La frecuencia podrá ser:

Diaria.
Días específicos de la semana.
✅ Checklist diaria

Cada día el usuario podrá consultar sus hábitos programados y registrar su cumplimiento.

La interfaz permite:

Marcar hábitos como cumplidos.
Registrar valores numéricos cuando corresponda.
Consultar el estado actual.
Actualizar el progreso sin recargar la página.
Mantener el historial de cumplimiento.

Ejemplo:

☑ Dormir 8 horas
☑ Estudiar 2 horas
☐ Hacer ejercicio
☑ Tomar agua
🎮 Sistema de gamificación

Uno de los elementos principales de HÁBITOS+ es convertir las acciones diarias en progreso.

⭐ Puntos

Cada hábito cumplido puede generar puntos.

Ejemplo:

Hábito cumplido
      ↓
   +10 puntos
      ↓
Actualización del nivel

También se contemplan puntos adicionales al alcanzar determinados hitos de racha.

🔥 Rachas

Las rachas representan la constancia del usuario.

Una racha aumenta cuando el hábito se cumple durante días consecutivos.

Ejemplo:

Día 1  🔥 1 día
Día 2  🔥 2 días
Día 3  🔥 3 días
Día 4  🔥 4 días
Día 5  🔥 5 días
Día 6  🔥 6 días
Día 7  🏆 7 días

El sistema mantiene:

Racha actual.
Racha máxima histórica.
🏆 Logros e insignias

Los logros se desbloquean automáticamente cuando el usuario alcanza determinados objetivos.

Ejemplos:

🏅 Semana completa.
🏃 30 días consecutivos de ejercicio.
😴 Buen descanso durante 10 días consecutivos.

Los logros obtenidos se muestran en el perfil del usuario como una vitrina de logros.

📊 Dashboard

El dashboard es el centro de la experiencia de HÁBITOS+.

Permite visualizar de forma rápida:

📈 Progreso semanal y mensual

El usuario podrá alternar entre diferentes períodos para analizar su evolución.

🗓️ Mapa de calor

Se presenta un calendario visual similar al sistema de contribuciones de GitHub.

Cada día representa visualmente la cantidad de hábitos cumplidos.

⭐ Puntos y nivel

Muestra los puntos acumulados y el nivel actual del usuario.

🔥 Racha

Destaca la racha activa más larga.

🎉 Retroalimentación inmediata

Al completar un hábito, el sistema puede mostrar información como:

🎉 +10 puntos
🔥 Racha de 6 días

Si se desbloquea un logro:

🏆 ¡Nuevo logro desbloqueado!
🧩 Arquitectura funcional

El proyecto está organizado alrededor de tres grandes componentes:

                    ┌─────────────────────┐
                    │      HÁBITOS+       │
                    │   Aplicación Web    │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
        ┌───────────┐    ┌────────────┐   ┌─────────────┐
        │ Frontend  │    │  Backend   │   │ Base datos  │
        │  React    │◄──►│ Node/      │◄─►│ MySQL /     │
        │           │    │ Express    │   │ PostgreSQL  │
        └───────────┘    └────────────┘   └─────────────┘
🗄️ Modelo de datos

La estructura inicial contempla las siguientes entidades:

Tabla	Propósito
usuarios	Información de las personas registradas
habitos	Hábitos configurados por cada usuario
registros_diarios	Cumplimiento diario de cada hábito
rachas	Control de rachas actuales y máximas
logros	Logros desbloqueados por cada usuario
Relaciones principales
USUARIO
   │
   ├──────────► HÁBITOS
   │                │
   │                ▼
   │        REGISTROS_DIARIOS
   │                │
   │                ▼
   │             RACHAS
   │
   └──────────► LOGROS
🛠️ Tecnologías

Las tecnologías propuestas para el desarrollo son:

Frontend
React
Recharts o Chart.js
HTML5
CSS3
JavaScript
Backend
Node.js
Express




Base de datos
PostgreSQL
Autenticación
JSON Web Tokens (JWT)
Manejo de sesiones

La especificación original contempla React para el frontend, Node.js con Express o PHP para backend y MySQL o PostgreSQL para la base de datos.
