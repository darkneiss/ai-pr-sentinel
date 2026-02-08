# Especificación 001: Gobernanza de Issues y Triaje Automático

## 1. Resumen Ejecutivo
El sistema actuará como una "puerta de calidad" (Quality Gate) automatizada. Cada vez que se crea o edita una Issue, el Sentinel analizará su contenido para asegurar que cumple con los estándares mínimos de información antes de molestar al equipo humano.

## 2. Reglas de Negocio (Domain Rules)

### RN-01: Integridad del Título
- **Objetivo:** Evitar títulos vagos como "ayuda", "error", "bug".
- **Lógica:**
  - Debe existir (no nulo/vacío).
  - Longitud mínima: **10 caracteres**.
  - No puede contener únicamente palabras genéricas (lista negra: "bug", "error", "issue", "help").

### RN-02: Integridad de la Descripción
- **Objetivo:** Asegurar contexto suficiente para reproducir el problema.
- **Lógica:**
  - Debe existir.
  - Longitud mínima: **30 caracteres**.
  - (Futuro) Debe contener secciones clave como "Steps to reproduce" (fuera del alcance actual).

### RN-03: Identidad del Autor
- **Lógica:** El autor debe estar identificado (no `null`).

## 3. Comportamiento del Sistema (Flujo)

### Escenario A: Issue Inválida (Validation Failure)
Cuando se detecta una violación de las reglas RN-01 o RN-02:
1.  **Acción 1 (Label):** El sistema añade la etiqueta `triage/needs-info` o `invalid`.
2.  **Acción 2 (Comment):** El sistema publica un comentario automático listando los errores específicos encontrados.
3.  **Acción 3 (State):** (Opcional) El sistema no cierra la issue automáticamente, pero alerta al usuario.

### Escenario B: Issue Válida (Happy Path)
1.  **Acción:** Si existen etiquetas de error previas (`invalid`), el sistema las retira.
2.  **Log:** Se registra internamente que la issue ha pasado el filtro.

## 4. API & Eventos (Infrastructure)

### Trigger: GitHub Webhooks
El sistema debe escuchar los siguientes eventos del webhook:
- `issues.opened`
- `issues.edited`

### Payload Esperado (Simplificado)
```json
{
  "action": "opened",
  "issue": {
    "number": 12,
    "title": "Bug in login",
    "body": "It crashes.",
    "user": {
      "login": "dev_user"
    }
  },
  "repository": {
    "full_name": "org/repo"
  }
}
```

## 5. Implementación Técnica (Hexagonal)
- Domain: Issue (Entidad), IssueValidationService (Servicio de Dominio).

- Application: ValidateIssueUseCase (Orquestador).

- Infrastructure: GithubWebhookController (Entrada), GithubRestAdapter (Salida para comentar/etiquetar).
