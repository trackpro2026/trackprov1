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
| **farmer** | Manages farm profile, animals, and tracking events |
| **doctor** | Veterinarian — health records, assigned animals, public directory |
| **admin** | Approves vets, lists users, platform analytics |

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
1. \`POST /${API_PREFIX}/auth/signup\` (farmer) or \`signup/doctor\` / \`signup/admin\`
2. \`POST /${API_PREFIX}/auth/verify-email\` with OTP (except admin)
3. \`POST /${API_PREFIX}/auth/login\` → copy \`accessToken\`
4. Click **Authorize** above and paste the JWT (mobile & web)

## CRUD summary

### Animals \`/animals\` (farmer CRUD + vet read/update)
| Method | Path | Who |
|--------|------|-----|
| POST | /animals | Farmer — create |
| GET | /animals | Farmer / Doctor / Admin — list |
| GET | /animals/:id | Farmer / Doctor / Admin — one |
| PATCH | /animals/:id | Farmer / Doctor / Admin — **update** |
| DELETE | /animals/:id | Farmer / Admin — delete |

### Health records \`/health-records\`
| Method | Path | Who |
|--------|------|-----|
| POST | /health-records | Doctor — create |
| GET | /health-records | Doctor — my records |
| GET | /health-records/animal/:animalId | Farmer / Doctor / Admin — by animal |
| GET | /health-records/:id | Farmer / Doctor / Admin — one |
| PATCH | /health-records/:id | Doctor / Admin — **update** |
| DELETE | /health-records/:id | Doctor / Admin — delete |

### Tracking \`/tracking\` (farmer only)
| Method | Path | Who |
|--------|------|-----|
| POST | /tracking | Farmer — create |
| GET | /tracking | Farmer — list all (optional ?animalId=) |
| GET | /tracking/animal/:animalId | Farmer — by animal |
| GET | /tracking/:id | Farmer — one |
| PATCH | /tracking/:id | Farmer — **update** |
| DELETE | /tracking/:id | Farmer — delete |

Pagination: \`?page=1&limit=10\` on list endpoints.
`.trim();

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Trackpro API')
    .setDescription(
      'Track-pro **livestock tracking** API — farmers, veterinarians, animals, health records, and weight/location logs.\n\n' +
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
