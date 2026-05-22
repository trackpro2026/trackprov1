import { writeFileSync } from 'fs';

/** Must match src/common/constants/api.constants.ts */
const API_PREFIX = 'api/v1';

const bearer = { key: 'Authorization', value: 'Bearer {{accessToken}}' };
const auth = [bearer];

function parseUrl(pathWithQuery, { root = false } = {}) {
  const [pathPart, queryString] = pathWithQuery.split('?');
  let urlPath = pathPart.startsWith('/') ? pathPart.slice(1) : pathPart;
  if (!root) {
    urlPath = `${API_PREFIX}/${urlPath}`.replace(/\/+/g, '/');
  }
  const path = urlPath.split('/').filter(Boolean);
  const query = [];
  if (queryString) {
    for (const pair of queryString.split('&')) {
      const [key, value = ''] = pair.split('=');
      query.push({ key, value });
    }
  }
  const raw =
    query.length > 0
      ? `{{baseUrl}}/${path.join('/')}?${query.map((q) => `${q.key}=${q.value}`).join('&')}`
      : `{{baseUrl}}/${path.join('/')}`;
  return { raw, path, query };
}

function req(name, method, pathWithQuery, opts = {}) {
  const { raw, path, query } = parseUrl(pathWithQuery, { root: opts.root });
  const url = { raw, host: ['{{baseUrl}}'], path };
  if (query.length) url.query = query;

  const item = {
    name,
    request: {
      method,
      header: opts.public ? [] : [...auth],
      url,
      description: opts.description,
    },
  };
  if (opts.body) {
    item.request.header.push({ key: 'Content-Type', value: 'application/json' });
    item.request.body = { mode: 'raw', raw: JSON.stringify(opts.body, null, 2) };
  }
  if (opts.test) {
    item.event = [{ listen: 'test', script: { type: 'text/javascript', exec: opts.test } }];
  }
  return item;
}

const saveToken = [
  'const j = pm.response.json();',
  "if (j.accessToken) {",
  "  pm.environment.set('accessToken', j.accessToken);",
  "  pm.collectionVariables.set('accessToken', j.accessToken);",
  '}',
  'if (j.user && j.user.id) {',
  "  if (j.user.role === 'farmer') {",
  "    pm.environment.set('farmerId', j.user.id);",
  "    pm.collectionVariables.set('farmerId', j.user.id);",
  '  }',
  "  if (j.user.role === 'doctor') {",
  "    pm.environment.set('doctorId', j.user.id);",
  "    pm.collectionVariables.set('doctorId', j.user.id);",
  '  }',
  '}',
].join('\n');

const saveAnimalId = [
  'const j = pm.response.json();',
  'const id = j._id || j.id;',
  "if (id) {",
  "  pm.environment.set('animalId', id);",
  "  pm.collectionVariables.set('animalId', id);",
  '}',
].join('\n');

const saveHealthRecordId = [
  'const j = pm.response.json();',
  'const id = j._id || j.id;',
  "if (id) {",
  "  pm.environment.set('healthRecordId', id);",
  "  pm.collectionVariables.set('healthRecordId', id);",
  '}',
].join('\n');

const collection = {
  info: {
    name: 'Trackpro API',
    description:
      'Track-pro API (Figma): farmer, veterinarian, slaughterhouse, admin dashboards.\n\n' +
      'Import with `Trackpro.local.postman_environment.json`.\n\n' +
      'Roles: `farmer` | `doctor` | `slaughterhouse` | `admin`\n' +
      '• Livestock: /livestock • Visits: /veterinary-visits • AI: /ai/*\n' +
      '• Shared: /dashboard/me, /notifications, /map/markers\n\n' +
      'Base path: /api/v1. Health & Swagger stay at root. Run Sign Up + Login first; tests auto-set tokens and IDs.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: {
    type: 'bearer',
    bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }],
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:3000' },
    { key: 'accessToken', value: '' },
    { key: 'farmerId', value: '' },
    { key: 'doctorId', value: '' },
    { key: 'animalId', value: '' },
    { key: 'healthRecordId', value: '' },
    { key: 'slaughterhouseId', value: '' },
    { key: 'slaughterRecordId', value: '' },
    { key: 'uploadUrl', value: '' },
  ],
  item: [
    {
      name: 'Health',
      item: [
        req('Root', 'GET', '/', { public: true, root: true }),
        req('Health', 'GET', '/health', { public: true, root: true }),
      ],
    },
    {
      name: 'Doctors (Public)',
      item: [
        req('List Doctors', 'GET', '/doctors?page=1&limit=10', {
          public: true,
          description: 'Public directory of approved veterinarians.',
        }),
        req('Get Doctor by Id', 'GET', '/doctors/{{doctorId}}', { public: true }),
      ],
    },
    {
      name: 'Auth',
      item: [
        req('Get CSRF Token', 'GET', '/auth/csrf', {
          public: true,
          description:
            'Web cookie sessions only (CSRF_ENABLED=true). Sets csrf_token cookie; send csrfToken as X-CSRF-Token header.',
        }),
        req('Sign Up Farmer', 'POST', '/auth/signup', {
          public: true,
          body: { name: 'John Farmer', email: 'farmer@example.com', password: 'password123' },
          test: saveToken,
        }),
        req('Sign Up Doctor', 'POST', '/auth/signup/doctor', {
          public: true,
          body: { name: 'Dr Smith', email: 'doctor@example.com', password: 'password123' },
          test: saveToken,
        }),
        req('Sign Up Admin', 'POST', '/auth/signup/admin', {
          public: true,
          body: { name: 'Admin User', email: 'admin@example.com', password: 'password123' },
          test: saveToken,
        }),
        req('Sign Up Slaughterhouse', 'POST', '/auth/signup/slaughterhouse', {
          public: true,
          body: {
            name: 'Abattoir Operator',
            email: 'slaughter@example.com',
            phone: '+2348012345678',
            address: '12 Abattoir Road, Kano',
            password: 'password123',
          },
          test: saveToken,
        }),
        req('Login Farmer', 'POST', '/auth/login', {
          public: true,
          body: { email: 'farmer@example.com', password: 'password123' },
          test: saveToken,
          description: 'Requires verified email for non-admin accounts.',
        }),
        req('Login Doctor', 'POST', '/auth/login/doctor', {
          public: true,
          body: { email: 'doctor@example.com', password: 'password123' },
          test: saveToken,
          description: '403 if account is not role doctor.',
        }),
        req('Login Slaughterhouse', 'POST', '/auth/login/slaughterhouse', {
          public: true,
          body: { email: 'slaughter@example.com', password: 'password123' },
          test: saveToken,
        }),
        req('Verify Email', 'POST', '/auth/verify-email', {
          public: true,
          body: { email: 'farmer@example.com', otp: 'ABCD1234' },
        }),
        req('Request Verification Code', 'POST', '/auth/request-verification-code', {
          public: true,
          body: { email: 'farmer@example.com' },
        }),
        req('Forgot Password', 'POST', '/auth/forgot-password', {
          public: true,
          body: { email: 'farmer@example.com' },
        }),
        req('Reset Password', 'POST', '/auth/reset-password', {
          public: true,
          body: { token: 'reset-token-from-email', newPassword: 'newpassword123' },
          description: 'Or use uid + reset from email link.',
        }),
        req('Logout', 'POST', '/auth/logout', { public: true }),
      ],
    },
    {
      name: 'Users',
      item: [
        req('Get Me', 'GET', '/users/me'),
        req('Get User by Id', 'GET', '/users/{{farmerId}}', { public: true }),
        req('Update Profile', 'PATCH', '/users/me', {
          body: {
            name: 'John Updated',
            phone: '+15551234567',
            farmName: 'Green Valley Ranch',
            farmLocation: 'Texas, USA',
            farmSizeHectares: 120,
            assignedDoctorId: '{{doctorId}}',
          },
        }),
        req('Update Settings', 'PATCH', '/users/me/settings', {
          body: {
            emailNotifications: true,
            pushNotifications: true,
            healthAlerts: true,
            language: 'en',
            timezone: 'UTC',
          },
        }),
        req('Change Password', 'PATCH', '/users/me/password', {
          body: { currentPassword: 'password123', newPassword: 'newpassword456' },
        }),
      ],
    },
    {
      name: 'Doctor Portal',
      item: [
        req('Complete Profile', 'PATCH', '/doctor/profile', {
          body: {
            clinicName: 'Valley Veterinary Clinic',
            licenseNumber: 'VET-2024-001',
            location: 'Austin, TX',
            specialties: ['cattle', 'goat'],
            speciesTreated: ['cattle', 'sheep', 'goat'],
            bio: 'Large animal practice serving central Texas.',
          },
          description: 'Doctor role only. Marks profile complete for directory listing.',
        }),
      ],
    },
    {
      name: 'Livestock',
      item: [
        req('Create Livestock', 'POST', '/livestock', {
          body: {
            tagId: 'EAR-001',
            name: 'Bessie',
            species: 'cattle',
            breed: 'Angus',
            sex: 'female',
            weightKg: 450,
            healthStatus: 'healthy',
            assignedDoctorId: '{{doctorId}}',
          },
          test: saveAnimalId,
          description: 'Farmer role only.',
        }),
        req('Livestock Stats', 'GET', '/livestock/stats'),
        req('List Livestock', 'GET', '/livestock?page=1&limit=10&obtainedBy=native'),
        req('Get Livestock Detail', 'GET', '/livestock/{{animalId}}'),
        req('Update Livestock', 'PATCH', '/livestock/{{animalId}}', {
          body: { weightKg: 455, healthStatus: 'healthy' },
        }),
        req('Delete Livestock', 'DELETE', '/livestock/{{animalId}}'),
      ],
    },
    {
      name: 'Veterinary Visits',
      item: [
        req('Log Visit', 'POST', '/veterinary-visits', {
          body: {
            animalId: '{{animalId}}',
            visitDate: '2026-05-17T12:00:00.000Z',
            type: 'checkup',
            reason: 'Routine Checkup',
            status: 'pending',
          },
          test: saveHealthRecordId,
        }),
        req('Vet Overview (Figma)', 'GET', '/veterinary-visits/overview?month=5&year=2026'),
        req('Vet Analytics (Charts)', 'GET', '/veterinary-visits/analytics?months=6'),
        req('Visit Stats (Doctor)', 'GET', '/veterinary-visits/stats'),
        req('List Visits (Doctor)', 'GET', '/veterinary-visits?page=1&limit=10&search=checkup'),
        req('Doctor Overview Alias', 'GET', '/doctor/overview'),
        req('List Visits for Animal', 'GET', '/veterinary-visits/animal/{{animalId}}?page=1&limit=10'),
        req('Get Visit', 'GET', '/veterinary-visits/{{healthRecordId}}'),
        req('Update Visit', 'PATCH', '/veterinary-visits/{{healthRecordId}}', {
          body: { status: 'completed' },
        }),
      ],
    },
    {
      name: 'Notifications',
      item: [
        req('List Notifications', 'GET', '/notifications?page=1&limit=20'),
        req('Mark All Read', 'PATCH', '/notifications/read-all'),
      ],
    },
    {
      name: 'Map',
      item: [req('Map Markers', 'GET', '/map/markers')],
    },
    {
      name: 'Slaughterhouse',
      item: [
        req('List Approved Facilities', 'GET', '/slaughterhouses', { public: true }),
        req('List All Facilities (Admin)', 'GET', '/slaughterhouses/all'),
        req('Create Facility (Admin)', 'POST', '/slaughterhouses', {
          body: {
            name: 'Kano Central Abattoir',
            location: 'Kano, Nigeria',
            state: 'Kano',
            licenseNumber: 'ABT-2024-001',
            contactPhone: '+2348000000000',
          },
        }),
        req('Schedule Slaughter', 'POST', '/slaughter-records', {
          body: {
            animalId: '{{animalId}}',
            slaughterhouseId: '{{slaughterhouseId}}',
            scheduledDate: '2026-06-01T08:00:00.000Z',
            liveWeightKg: 450,
          },
        }),
        req('List Slaughter Records', 'GET', '/slaughter-records?page=1&limit=10'),
        req('Slaughterhouse Overview', 'GET', '/slaughterhouse/overview', {
          description: 'Figma overview: processAlerts, animalsRegisteredTable.',
        }),
        req('Slaughterhouse Livestock Table', 'GET', '/slaughterhouse/livestock?page=1&limit=10'),
        req('Slaughterhouse Facility Records', 'GET', '/slaughterhouse/records?page=1&limit=10'),
        req('Complete Slaughterhouse Profile', 'PATCH', '/slaughterhouse/profile', {
          body: {
            facilityName: 'Kano Central Abattoir',
            location: 'Kano, Nigeria',
            state: 'Kano',
            licenseNumber: 'ABT-2024-001',
          },
        }),
      ],
    },
    {
      name: 'AI',
      item: [
        req('Health Check (Photo)', 'POST', '/ai/health-check', {
          body: {
            image: 'base64-image-here',
            animalType: 'cattle',
            animalId: '{{animalId}}',
          },
        }),
        req('Vet Assistant Chat', 'POST', '/ai/vet-assistant', {
          body: { message: 'My goat has watery eyes', language: 'en' },
        }),
        req('Guardian Outbreak', 'POST', '/ai/guardian', {
          body: {
            recentCases: [{ species: 'goat', diagnosis: 'PPR', location: 'Kano' }],
            region: 'Kano',
          },
        }),
        req('Health Score', 'POST', '/ai/health-score', {
          body: { animalId: '{{animalId}}', species: 'cattle' },
        }),
        req('Vaccination Schedule', 'POST', '/ai/vaccination-schedule', {
          body: { animalId: '{{animalId}}', species: 'cattle' },
        }),
        req('Surveillance Report', 'POST', '/ai/report', {
          body: {
            state: 'Kano',
            dateFrom: '2026-01-01',
            dateTo: '2026-05-01',
            data: { totalCases: 12, mortalityCount: 1 },
          },
        }),
      ],
    },
    {
      name: 'Dashboard',
      item: [
        req('My Dashboard', 'GET', '/dashboard/me', {
          description: 'Farmer or doctor summary based on JWT role.',
        }),
        req('Farmer Dashboard', 'GET', '/dashboard/farmer'),
        req('Farmer Overview', 'GET', '/farmer/overview?month=5&year=2026'),
        req('Farmer Livestock Stats', 'GET', '/farmer/livestock/stats'),
        req('Doctor Dashboard', 'GET', '/dashboard/doctor'),
      ],
    },
    {
      name: 'Admin',
      item: [
        req('Admin Overview', 'GET', '/admin/overview'),
        req('Analytics', 'GET', '/admin/analytics'),
        req('Livestock Stats', 'GET', '/admin/livestock/stats'),
        req('List Livestock', 'GET', '/admin/livestock?page=1&limit=10'),
        req('Visit Stats', 'GET', '/admin/veterinary-visits/stats'),
        req('List Veterinary Visits', 'GET', '/admin/veterinary-visits?page=1&limit=10'),
        req('List Slaughterhouses', 'GET', '/admin/slaughterhouses?page=1&limit=10'),
        req('List Farmers', 'GET', '/admin/farmers?page=1&limit=10'),
        req('Get Farmer Detail', 'GET', '/admin/farmers/{{farmerId}}'),
        req('List Doctors', 'GET', '/admin/doctors?page=1&limit=10'),
        req('Get Doctor Detail', 'GET', '/admin/doctors/{{doctorId}}'),
        req('Get User by Id', 'GET', '/admin/users/{{farmerId}}'),
        req('Update User State', 'PATCH', '/admin/users/{{farmerId}}', {
          body: { userState: 'active' },
        }),
        req('Approve Doctor', 'PATCH', '/admin/doctors/{{doctorId}}/status', {
          body: { status: 'approved' },
          description: 'status: pending_review | approved | declined | active | inactive',
        }),
        req('Create User', 'POST', '/admin/users', {
          body: {
            name: 'New Farmer',
            email: 'newfarmer@example.com',
            password: 'password123',
            role: 'farmer',
          },
        }),
      ],
    },
    {
      name: 'Upload',
      item: [
        req('Get Resource (public)', 'GET', '/upload/resource?url={{uploadUrl}}', {
          public: true,
          description: 'Cloudinary metadata for a delivery URL.',
        }),
        req('Open URL (redirect)', 'GET', '/upload/open?url={{uploadUrl}}', {
          public: true,
        }),
        req('Stream (proxy)', 'GET', '/upload/stream?url={{uploadUrl}}', {
          public: true,
        }),
        {
          name: 'Upload Single File',
          request: {
            method: 'POST',
            header: [bearer],
            body: {
              mode: 'formdata',
              formdata: [
                { key: 'file', type: 'file', src: '', description: 'Select image or PDF' },
              ],
            },
            url: {
              raw: `{{baseUrl}}/${API_PREFIX}/upload/single`,
              host: ['{{baseUrl}}'],
              path: API_PREFIX.split('/').concat(['upload', 'single']),
            },
            description:
              'Multipart field `file`. Farmer → userFileUrls; doctor → doctorProfile.documentUrls. Query attachTo=none to skip DB.',
          },
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  'const j = pm.response.json();',
                  "const url = j.url || j.publicUrl || (j.files && j.files[0] && j.files[0].url);",
                  "if (url) { pm.environment.set('uploadUrl', url); pm.collectionVariables.set('uploadUrl', url); }",
                ],
              },
            },
          ],
        },
        {
          name: 'Upload Multiple Files',
          request: {
            method: 'POST',
            header: [bearer],
            body: {
              mode: 'formdata',
              formdata: [
                { key: 'files', type: 'file', src: '', description: 'Up to 10 files' },
              ],
            },
            url: {
              raw: `{{baseUrl}}/${API_PREFIX}/upload/multiple`,
              host: ['{{baseUrl}}'],
              path: API_PREFIX.split('/').concat(['upload', 'multiple']),
            },
          },
        },
        req('Delete Upload', 'DELETE', '/upload', {
          body: { url: '{{uploadUrl}}' },
        }),
        req('Delete Batch', 'POST', '/upload/remove-batch', {
          body: { urls: ['{{uploadUrl}}'] },
        }),
      ],
    },
  ],
};

writeFileSync('postman/Trackpro.postman_collection.json', JSON.stringify(collection, null, 2));

const environment = {
  name: 'Trackpro Local',
  values: [
    { key: 'baseUrl', value: 'http://localhost:3000', type: 'default', enabled: true },
    { key: 'accessToken', value: '', type: 'secret', enabled: true },
    { key: 'farmerId', value: '', type: 'default', enabled: true },
    { key: 'doctorId', value: '', type: 'default', enabled: true },
    { key: 'animalId', value: '', type: 'default', enabled: true },
    { key: 'healthRecordId', value: '', type: 'default', enabled: true },
    { key: 'uploadUrl', value: '', type: 'default', enabled: true },
  ],
  _postman_variable_scope: 'environment',
};

writeFileSync('postman/Trackpro.local.postman_environment.json', JSON.stringify(environment, null, 2));

console.log('Wrote postman/Trackpro.postman_collection.json');
console.log('Wrote postman/Trackpro.local.postman_environment.json');
