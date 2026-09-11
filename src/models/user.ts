export interface User {
  id: number;
  nombre: string;
  correo: string;
  password_hash: string;
  creado_en: string;
}

export interface UserPublic {
  id: number;
  nombre: string;
  correo: string;
  creado_en: string;
}

export function toPublicUser(user: User): UserPublic {
  return {
    id: user.id,
    nombre: user.nombre,
    correo: user.correo,
    creado_en: user.creado_en,
  };
}
