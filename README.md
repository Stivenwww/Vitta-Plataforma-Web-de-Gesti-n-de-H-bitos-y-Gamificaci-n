<div align="center">

# 🌱 HÁBITOS+

### Dashboard Gamificado de Hábitos Saludables

**Convierte tus hábitos diarios en progreso visible.**

[![React](https://img.shields.io/badge/Frontend-React-61DAFB?style=for-the-badge&logo=react&logoColor=white)](#-tecnologías)
[![Node.js](https://img.shields.io/badge/Backend-Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)](#-tecnologías)
[![Express](https://img.shields.io/badge/Framework-Express-000000?style=for-the-badge&logo=express&logoColor=white)](#-tecnologías)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](#-tecnologías)
[![JWT](https://img.shields.io/badge/Auth-JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)](#-autenticación)

[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](#)
[![Status](https://img.shields.io/badge/status-en%20desarrollo-yellow?style=flat-square)](#)
[![PRs](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](#)

</div>

<br>

<p align="center">
  <img src="https://img.shields.io/badge/🔥-Rachas-orange?style=social" />
  <img src="https://img.shields.io/badge/⭐-Puntos-yellow?style=social" />
  <img src="https://img.shields.io/badge/🏆-Logros-purple?style=social" />
  <img src="https://img.shields.io/badge/📊-Dashboard-blue?style=social" />
</p>

---

## 📖 Tabla de contenido

- [📌 Descripción del proyecto](#-descripción-del-proyecto)
- [🎯 Objetivos](#-objetivos)
- [✨ Funcionalidades principales](#-funcionalidades-principales)
- [🧩 Arquitectura funcional](#-arquitectura-funcional)
- [🗄️ Modelo de datos](#️-modelo-de-datos)
- [🛠️ Tecnologías](#️-tecnologías)

---

## 📌 Descripción del proyecto

En la vida universitaria y laboral, mantener hábitos como dormir adecuadamente, estudiar, hacer ejercicio, hidratarse o leer puede resultar difícil debido a las múltiples responsabilidades diarias.

**HÁBITOS+** propone una solución mediante un ciclo sencillo:

<div align="center">

```mermaid
flowchart LR
    A[⚙️ Configurar] --> B[📝 Registrar]
    B --> C[✅ Cumplir]
    C --> D[⭐ Obtener puntos]
    D --> E[🔥 Mantener rachas]
    E --> F[🏆 Desbloquear logros]
    F --> G[📊 Visualizar progreso]
    G -.retroalimenta.-> A

    style A fill:#e0f2fe,stroke:#0284c7,color:#0c4a6e
    style B fill:#dbeafe,stroke:#2563eb,color:#1e3a8a
    style C fill:#dcfce7,stroke:#16a34a,color:#14532d
    style D fill:#fef9c3,stroke:#ca8a04,color:#713f12
    style E fill:#ffedd5,stroke:#ea580c,color:#7c2d12
    style F fill:#f3e8ff,stroke:#9333ea,color:#581c87
    style G fill:#e0e7ff,stroke:#4f46e5,color:#312e81
```

</div>

El sistema permite que cada usuario configure sus propios hábitos y registre diariamente su cumplimiento. La información se transforma en indicadores visuales que permiten comprender la evolución y mantener la motivación.

---

## 🎯 Objetivos

### Objetivo general

> Desarrollar una aplicación web que permita a los usuarios registrar, monitorear y visualizar el cumplimiento de sus hábitos saludables diarios, incorporando mecanismos de gamificación que incentiven la constancia y el compromiso personal.

### Objetivos específicos

| # | Objetivo |
|---|----------|
| 1 | Diseñar un modelo de datos simple y escalable |
| 2 | Permitir el registro y seguimiento diario de hábitos |
| 3 | Implementar un sistema de puntos |
| 4 | Calcular y visualizar rachas de cumplimiento |
| 5 | Crear un catálogo de logros desbloqueables |
| 6 | Mostrar el progreso mediante gráficas |
| 7 | Implementar un mapa de calor tipo calendario |
| 8 | Mostrar puntos, nivel y racha activa |
| 9 | Facilitar el registro de hábitos mediante una interfaz sencilla |
| 10 | Mantener una experiencia responsive para diferentes dispositivos |

---

## ✨ Funcionalidades principales

### 🔐 Autenticación

El usuario podrá crear una cuenta, iniciar sesión y acceder de forma segura a su información mediante **rutas protegidas** y **sesión persistente con JWT**.

- ✅ Validación de campos
- ✅ Manejo de errores
- ✅ Protección de la información del usuario

<br>

### 📝 Configuración de hábitos

<table>
<tr>
<td width="50%" valign="top">

**Hábitos predefinidos**

| Ícono | Hábito |
|:---:|---|
| 😴 | Dormir |
| 📚 | Estudiar |
| 🏃 | Hacer ejercicio |
| 💧 | Tomar agua |
| 📖 | Leer |

</td>
<td width="50%" valign="top">

**Hábito personalizado**

- Nombre
- Meta
- Frecuencia:
  - Diaria
  - Días específicos de la semana

</td>
</tr>
</table>

<br>

### ✅ Checklist diaria

Cada día el usuario consulta sus hábitos programados y registra su cumplimiento, sin recargar la página y manteniendo historial completo.

```
☑ Dormir 8 horas
☑ Estudiar 2 horas
☐ Hacer ejercicio
☑ Tomar agua
```

<br>

### 🎮 Sistema de gamificación

<table>
<tr>
<td width="50%" valign="top">

#### ⭐ Puntos

Cada hábito cumplido genera puntos, más bonificaciones al alcanzar hitos de racha.

```mermaid
flowchart TD
    A[Hábito cumplido] --> B["+10 puntos"]
    B --> C[Actualización de nivel]
    style A fill:#dcfce7,stroke:#16a34a
    style B fill:#fef9c3,stroke:#ca8a04
    style C fill:#e0e7ff,stroke:#4f46e5
```

</td>
<td width="50%" valign="top">

#### 🔥 Rachas

La constancia se mide en días consecutivos de cumplimiento.

| Día | Racha |
|:---:|:---:|
| 1 | 🔥 1 día |
| 3 | 🔥 3 días |
| 5 | 🔥 5 días |
| 7 | 🏆 7 días |

Se guarda **racha actual** y **racha máxima histórica**.

</td>
</tr>
</table>

<br>

#### 🏆 Logros e insignias

Se desbloquean automáticamente al alcanzar objetivos, y se muestran en el perfil como vitrina de logros:

- 🏅 Semana completa
- 🏃 30 días consecutivos de ejercicio
- 😴 Buen descanso durante 10 días consecutivos

<br>

### 📊 Dashboard

El centro de la experiencia de HÁBITOS+:

| Componente | Descripción |
|---|---|
| 📈 **Progreso semanal / mensual** | Alterna entre períodos para analizar la evolución |
| 🗓️ **Mapa de calor** | Calendario visual estilo contribuciones de GitHub |
| ⭐ **Puntos y nivel** | Puntos acumulados y nivel actual del usuario |
| 🔥 **Racha activa** | Destaca la racha activa más larga |

<br>

### 🎉 Retroalimentación inmediata

<div align="center">

```
🎉 +10 puntos
🔥 Racha de 6 días

🏆 ¡Nuevo logro desbloqueado!
```

</div>

---

## 🧩 Arquitectura funcional

```mermaid
flowchart TB
    APP["🌱 HÁBITOS+<br/>Aplicación Web"]
    APP --> FE["🖥️ Frontend<br/>React"]
    APP --> BE["⚙️ Backend<br/>Node.js / Express"]
    APP --> DB["🗄️ Base de datos<br/>MySQL / PostgreSQL"]

    FE <--> BE
    BE <--> DB

    style APP fill:#0f172a,stroke:#0f172a,color:#ffffff
    style FE fill:#dbeafe,stroke:#2563eb,color:#1e3a8a
    style BE fill:#dcfce7,stroke:#16a34a,color:#14532d
    style DB fill:#fef3c7,stroke:#d97706,color:#78350f
```

---

## 🗄️ Modelo de datos

| Tabla | Propósito |
|---|---|
| `usuarios` | Información de las personas registradas |
| `habitos` | Hábitos configurados por cada usuario |
| `registros_diarios` | Cumplimiento diario de cada hábito |
| `rachas` | Control de rachas actuales y máximas |
| `logros` | Logros desbloqueados por cada usuario |

### Relaciones principales

```mermaid
erDiagram
    USUARIO ||--o{ HABITOS : configura
    HABITOS ||--o{ REGISTROS_DIARIOS : genera
    REGISTROS_DIARIOS ||--o{ RACHAS : actualiza
    USUARIO ||--o{ LOGROS : desbloquea
```

---

## 🛠️ Tecnologías

<div align="center">

| Capa | Tecnologías |
|---|---|
| **Frontend** | React · Recharts / Chart.js · HTML5 · CSS3 · JavaScript |
| **Backend** | Node.js · Express |
| **Base de datos** | PostgreSQL |
| **Autenticación** | JSON Web Tokens (JWT) · Manejo de sesiones |

</div>

---

## ⚙️ Backend: ejecución

```bash
cp .env.example .env        # DATABASE_URL, JWT_SECRET; en tu PC pon NODE_ENV=development
npm install
npm run migrate             # schema.sql + catalogos.sql en una transacción (idempotente)
npm run seed                # opcional: demo@demo.vitta / Demo1234!
npm run dev                 # API en http://localhost:3000
npm test                    # unitarias + integración (crea la BD vitta_test en el mismo servidor)
npm run typecheck && npm run build
```

Fechas: cada "día" es el día local del usuario. Por defecto `America/Bogota`; el cliente puede enviar `X-Timezone: <zona IANA>`.

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | `{usuario: {id, nombre, correo, creado_en}, token}` |
| GET / PATCH | `/api/users/me` | Perfil; `PATCH {nombre?, correo?}` → `{usuario, token}` (409 si el correo existe) |
| PATCH | `/api/users/me/password` | `{contrasena_actual, contrasena_nueva}` → `{mensaje, token}`; invalida los tokens anteriores |
| GET / POST | `/api/habits` | Hábitos activos (`?incluir_archivados=true`); campos `icono`, `categoria`, `meta_valor`, `unidad` |
| GET / PUT / DELETE | `/api/habits/:id` | `PUT` parcial; `DELETE` archiva si el hábito tiene historial |
| POST | `/api/habits/:id/archive`, `/api/habits/:id/restore` | Archivado lógico |
| GET / POST | `/api/habits/:id/records` | Registro diario `{fecha?, cumplido, valor?, notas?}` (uno por día) |
| PATCH | `/api/habits/:id/progreso` | Avance del día `{valor, fecha?, notas?}`; se completa al llegar a `meta_valor` |
| DELETE | `/api/habits/:id/records/:registroId` | Desmarcar (retira puntos y recalcula racha) |
| GET | `/api/habits/:id/streak`, `/api/habits/:id/progress` | Racha actual/máxima; progreso semanal o mensual |
| GET | `/api/progress?desde=&hasta=` | `[{fecha, total, completados, parciales}]` de todos los hábitos |
| GET | `/api/logros` | 14 logros con `obtenido`, `obtenido_en`, `progreso_actual`, `progreso_meta` |
| GET / POST / PATCH / DELETE | `/api/recordatorios[/:id]` | `{habito_id, hora: "HH:MM", activo}` |
| GET | `/api/points/me`, `/api/points/me/movements`, `/api/dashboard`, `/api/plantillas` | Puntos, dashboard y plantillas |

Las respuestas de `POST /records` y `PATCH /progreso` incluyen, además del registro, `racha` y `logros_desbloqueados`.

## 🧪 Pruebas

- `npm test` corre las pruebas unitarias (`tests/unit`) y de integración (`tests/integration`).
- Las de integración necesitan PostgreSQL: usan `TEST_DATABASE_URL` o `DATABASE_URL` y crean la base `vitta_test` en ese servidor. Si no hay PostgreSQL se saltan.
- `npm run test:unit` corre solo las unitarias (no necesitan base de datos).

## 📮 Colección de Postman

En `postman/` están `Vitta.postman_collection.json` (todas las rutas) y `Vitta.postman_environment.json`.

1. Importar los dos archivos en Postman y elegir el entorno **Vitta local**.
2. En el entorno poner `password` (8+ caracteres) y, si hace falta, cambiar `baseUrl` (por defecto `http://localhost:3000`).
3. Correr la colección completa con el Runner, en orden. El registro crea un usuario nuevo y el login guarda `{{token}}`.

La carpeta **5. Casos: rachas y puntos** prueba marcar, desmarcar, día perdido, registro repetido (409) y fecha futura (400). Las fechas se calculan con la hora de Bogotá.

## 🚀 Despliegue

Los pasos sirven para cualquier hosting que corra Node.js 18+ o Docker y tenga PostgreSQL.

1. **Crear la base de datos** PostgreSQL (versión 14 o más) y copiar su URL de conexión.
2. **Variables de entorno** en el servidor (ver `.env.example`):

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | URL de la base, p. ej. `postgresql://USUARIO:CLAVE@HOST:5432/vitta` (obligatoria) |
   | `JWT_SECRET` | Secreto largo y propio, mínimo 32 caracteres (obligatoria). Generarlo con `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
   | `NODE_ENV` | `production` |
   | `PORT` | Puerto de la API (si el hosting no lo pone solo) |

   Con `NODE_ENV=production` el servidor no arranca si falta `DATABASE_URL` o `JWT_SECRET`, o si el secreto es corto.
3. **Compilar y migrar**:
   - Sin Docker:
     ```bash
     npm ci
     npm run build              # compila a dist/ y copia los .sql
     npm run migrate:prod       # crea tablas y carga los 14 logros y 10 plantillas
     npm start                  # node dist/index.js
     ```
   - Con Docker:
     ```bash
     docker build -t vitta-backend .
     docker run --rm --env-file .env vitta-backend node dist/db/migrate.js
     docker run -d --env-file .env -p 3000:3000 vitta-backend
     ```
4. **Datos demo (opcional)**: `npm run seed:prod` (o `node dist/db/seed.js` en Docker) crea `demo@demo.vitta` / `Demo1234!`. Esa clave es pública: no lo corras en un servidor real con usuarios, o cambia la clave después.
5. **Probar**: `GET https://TU-SERVIDOR/health` debe responder `{"ok":true}`.
6. **Conectar la app**: generar el APK con `./gradlew assembleRelease -Pvitta.baseUrl=https://TU-SERVIDOR/api/` (ver README de la app). Usar HTTPS: el APK de release no permite HTTP.

CORS: no se configura porque el único cliente es la app Android (CORS solo aplica a navegadores). Si se hace un cliente web habría que agregarlo.


---

<div align="center">

**Hecho con 🔥 constancia y ⭐ puntos por convertir hábitos en progreso visible.**

</div>
