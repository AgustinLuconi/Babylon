# 🏫 Babylon — Sistema de Gestión Académica

> Proyecto Final de Carrera · Tec. Sup. en Desarrollo de Software · IES 9-010 Rosario Vera Peñaloza · 2026

---

## 📋 Descripción del proyecto

**Babylon** es una plataforma web de gestión académica desarrollada para el **Babylon English Institute**, un instituto de inglés con sede en San Luis, Argentina. Es un proyecto real: el sistema se va a implementar en producción en el instituto.

El sistema centraliza en una única herramienta digital los procesos que hoy se gestionan de forma fragmentada entre legajos físicos, múltiples hojas de cálculo de Excel y comunicaciones por WhatsApp.

### ¿Qué problema resuelve?

El instituto maneja manualmente el registro de asistencia, calificaciones, cuotas y legajos de sus 130 alumnos. Esto genera duplicación de trabajo, información dispersa y falta de acceso en tiempo real, afectando la eficiencia del equipo administrativo y docente.

### ¿Qué hace el sistema?

- Gestión completa de legajos de alumnos, con documentación digital (incluida autorización de imagen con aceptación digital tipo términos y condiciones)
- Registro de asistencia por clase
- Carga y consulta de calificaciones por evaluación, incluyendo nota de cierre por período
- Control de cuotas y pagos mensuales, con descuento automático del 10% a partir del segundo hijo
- Observaciones del profesor y del secretario, visibles para los padres
- Reportes académicos y financieros (cierre de julio, cierre de noviembre, anual)
- Acceso diferenciado por rol: **Administrador**, **Secretario**, **Profesor** y **Padre/Madre/Tutor**

---

## 🛠️ Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | React + TypeScript + Tailwind CSS + shadcn/ui |
| Manejo de datos remotos | TanStack Query + TanStack Table |
| Estado global (cliente) | Zustand |
| Formularios y validación | React Hook Form + Zod |
| Ruteo | React Router v6 |
| Backend | Node.js + Express + TypeScript |
| Autenticación | JWT |
| Validación (backend) | Zod |
| Base de datos | PostgreSQL |
| ORM | Prisma |
| Infraestructura local | Docker (PostgreSQL en contenedor) |
| Control de versiones | Git + GitHub |

---

## 🏗️ Arquitectura

El proyecto sigue los principios de **Clean Architecture** combinados con **Arquitectura Hexagonal (Puertos y Adaptadores)**, con organización **100% Feature-First**: no existen carpetas separadas por tipo de capa (domain/data/presentation). En cambio, cada módulo de negocio (alumnos, cuotas, cursos, etc.) agrupa en su propia carpeta TODO lo que le pertenece: su entidad, su esquema de validación, su repositorio, su servicio (casos de uso) y su controlador/rutas.

```
Adaptador de entrada          Núcleo del módulo                Adaptador de salida
(routes/controller)    →      service (casos de uso)   ←→   repository (interfaz/puerto)
                                                                ↑
                                                      FakeRepository (temporal, TP3)
                                                      PrismaRepository (real, producción)
```

Lo compartido entre todos los módulos (interfaces genéricas de repositorio, clases de error de dominio, UnitOfWork, conexión a Prisma) vive en `core/`, no repetido en cada feature. El `service` de cada módulo no importa nada de Express ni de Prisma directamente: recibe su repositorio por inyección de dependencias, y la decisión de qué implementación usar (Fake o Prisma) se toma en un único *composition root* (`container.ts`).

### Estructura de carpetas

```
Babylon/
├── docker-compose.yml          # PostgreSQL en contenedor
├── README.md
├── docs/                       # TPs, relevamiento, decisiones de arquitectura
│
├── server/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── src/
│       ├── core/
│       │   ├── errors.ts        # DomainError, EntityNotFoundError, ConflictError, ValidationError
│       │   ├── ports.ts         # interfaces genéricas: Repository<T>, UnitOfWork
│       │   ├── adapters/
│       │   │   └── PrismaUnitOfWork.ts
│       │   ├── config.ts        # variables de entorno
│       │   ├── database.ts      # instancia de PrismaClient
│       │   └── middlewares/     # authMiddleware, errorHandler (Express)
│       │
│       ├── modules/
│       │   ├── usuarios/        # auth.entity.ts · repository.ts · service.ts · controller.ts · routes.ts · schema.ts
│       │   ├── alumnos/
│       │   ├── padres/
│       │   ├── profesores/
│       │   ├── cursos/
│       │   ├── cuotas/
│       │   ├── asistencia/
│       │   ├── calificaciones/
│       │   ├── observaciones/
│       │   └── documentos/
│       │
│       ├── container.ts         # composition root: decide Fake vs Prisma
│       └── server.ts
│
└── client/
    └── src/
        ├── core/
        │   ├── components/      # ui (shadcn), layout (Sidebar, Header, BottomNav)
        │   ├── store/            # Zustand: sessionStore (usuario, rol, token)
        │   ├── routes/           # AppRoutes, ProtectedRoute
        │   └── lib/               # utils, normalizarTexto
        │
        └── features/
            ├── auth/              # LoginPage, useAuth, authService
            ├── alumnos/           # pages, hooks (TanStack Query), alumnoService, types
            ├── cuotas/
            ├── cursos/
            ├── profesores/
            ├── asistencia/
            ├── calificaciones/
            ├── observaciones/
            ├── documentos/
            └── dashboard/         # variantes de dashboard por rol
```

Cada carpeta dentro de `modules/` (server) o `features/` (client) es autocontenida: si el día de mañana se retira o rediseña un módulo completo, se toca una sola carpeta.


---

## 👥 Roles del sistema

| Rol | Equivalencia en el instituto | Acceso |
|-----|-------------------------------|--------|
| **Administrador** | Directores / dueños | Acceso total: usuarios, cursos, profesores, reportes, cuotas, legajos |
| **Secretario** | Secretario administrativo | Legajos de alumnos, gestión de cuotas y pagos, observaciones a padres |
| **Profesor** | Docentes (5 en total) | Sus propios cursos: asistencia, calificaciones, notas de cierre, observaciones |
| **Padre/Madre/Tutor** | Padres, madres o tutores de alumnos | Solo lectura de su/s hijo/s: notas, asistencia, cuotas, documentación |

---

## ⚙️ Instalación y ejecución local

### Requisitos previos
- Node.js 24 LTS (versión fijada en `.nvmrc`: `nvm use`)
- pnpm 11, instalado con su instalador propio (`curl -fsSL https://get.pnpm.io/install.sh | sh -`, ver pnpm.io/installation) — **sin corepack**, que dejará de venir incluido en las próximas versiones de Node
- Docker y Docker Compose

### 1. Clonar el repositorio
```bash
git clone https://github.com/AgustinLuconi/Babylon.git
cd Babylon
```

### 2. Levantar la base de datos (PostgreSQL vía Docker)
```bash
docker compose up -d
```

### 3. Backend
```bash
cd server
pnpm install
cp .env.example .env
pnpm exec prisma migrate dev
pnpm exec prisma db seed
pnpm dev
```

### 4. Frontend
```bash
cd client
pnpm install
cp .env.example .env
pnpm dev
```

---

## 👥 Equipo de desarrollo

| Nombre | Rol |
|--------|-----|
| Luconi, Agustín | Desarrollador Fullstack |

---

## 🎯 Cliente

| Campo | Dato |
|-------|------|
| Instituto | Babylon English Institute |
| Responsable | Silvana Linares |
| Contacto | babylon.english.institute@gmail.com |
| Rubro | Enseñanza de lengua extranjera |
| Redes | [Instagram](https://www.instagram.com/babylon.english.institute/) · [Facebook](https://www.facebook.com/BabylonEugenioBustos) |

---

## 📌 Estado del proyecto

`En desarrollo` — Core funcional con arquitectura hexagonal y datos mockeados · Julio 2026

---

*Proyecto académico desarrollado en el marco de la materia Práctica Profesional III · Docente: Aristiaran, Martín León*
