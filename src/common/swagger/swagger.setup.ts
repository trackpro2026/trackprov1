import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { API_PREFIX, SWAGGER_PATH } from '../constants/api.constants';

/** Bearer JWT security scheme name — use with @ApiBearerAuth('access-token') */
export const SWAGGER_BEARER = 'access-token';

const API_GUIDE = `
## Base URL
All JSON endpoints use prefix **\`/${API_PREFIX}\`** unless noted (health & docs are at root).

## Roles
| Role | Description |
|------|-------------|
| **farmer** | Farm profile, livestock, map, notifications |
| **doctor** | Veterinary visits, assigned livestock, public directory |
| **slaughterhouse** | Facility profile, slaughter records, map |
| **admin** | Farmers, livestock, vets, slaughterhouses, visits, analytics |

## Mobile & web clients

| Client | Auth | CSRF |
|--------|------|------|
| **Mobile** (React Native, Flutter, etc.) | \`Authorization: Bearer <accessToken>\` from login response | **Not required** |
| **Web SPA** (recommended) | Same Bearer header | **Not required** |
| **Web** (httpOnly cookie session) | Cookie \`access_token\` + \`credentials: 'include'\` | Required when \`CSRF_ENABLED=true\` |

### Web with cookies + CSRF
1. \`GET /${API_PREFIX}/auth/csrf\` → \`{ csrfToken }\`
2. Send header \`X-CSRF-Token: <csrfToken>\` on POST/PATCH/DELETE (with \`credentials: 'include'\`)
3. \`POST /${API_PREFIX}/auth/login\` — sets auth cookie
4. Subsequent mutating requests: Bearer **or** cookie + CSRF header

### CORS
\`CORS_UNIVERSAL=true\` (default) allows any browser origin. Set \`CORS_UNIVERSAL=false\` and \`CORS_ORIGINS=\` for a whitelist in production.

Optional header: \`X-Client-Platform: mobile\` or \`web\`.

## Authentication
1. \`POST /${API_PREFIX}/auth/signup\` (farmer) or \`signup/doctor\` / \`signup/slaughterhouse\` / \`signup/admin\`
2. \`POST /${API_PREFIX}/auth/verify-email\` with OTP (except admin)
3. \`POST /${API_PREFIX}/auth/login\` → copy \`accessToken\`
4. Click **Authorize** above and paste the JWT (mobile & web)

## CRUD summary

### Livestock \`/livestock\`
| Method | Path | Who |
|--------|------|-----|
| POST | /livestock | Farmer — create |
| GET | /livestock | Farmer / Doctor / Admin — list |
| GET | /livestock/:id | Farmer / Doctor / Admin — one |
| PATCH | /livestock/:id | Farmer / Doctor / Admin — update |
| DELETE | /livestock/:id | Farmer / Admin — delete |

### Veterinary visits \`/veterinary-visits\`
| Method | Path | Who |
|--------|------|-----|
| POST | /veterinary-visits | Doctor — create |
| GET | /veterinary-visits | Doctor — my visits |
| GET | /veterinary-visits/stats | Doctor — overview metrics |
| GET | /veterinary-visits/animal/:animalId | Farmer / Doctor / Admin |
| GET/PATCH/DELETE | /veterinary-visits/:id | By role |

### Shared (all roles): \`/notifications\`, \`/map/markers\`, \`/dashboard/me\`

### AI \`/ai/*\` — unchanged (Gemini)

Pagination: \`?page=1&limit=10\` on list endpoints.
`.trim();

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Trackpro API')
    .setDescription(
      'Track-pro livestock API — farmers, veterinarians, slaughterhouses, and admin (Figma-aligned).\n\n' +
        API_GUIDE,
    )
    .setVersion('1.0')
    .addServer(`/${API_PREFIX}`, 'API v1')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description:
          'Primary auth for mobile and web. Value from login/signup `accessToken`.',
        in: 'header',
      },
      SWAGGER_BEARER,
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-CSRF-Token',
        in: 'header',
        description:
          'Only when CSRF_ENABLED=true and using cookie sessions (not Bearer). Get token from GET /auth/csrf.',
      },
      'csrf-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (_controllerKey: string, methodKey: string) =>
      methodKey,
  });

  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      showRequestDuration: true,
    },
    customSiteTitle: 'Trackpro API Docs',
  });
}
