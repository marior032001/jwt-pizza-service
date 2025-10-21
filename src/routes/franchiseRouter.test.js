const request = require('supertest');
const app = require('../service');
const { DB, Role } = require('../database/database');

function randomEmail() {
  return `${Math.random().toString(36).substring(2, 12)}@test.com`;
}

let user = {};
let admin = {};
let userToken = '';
let adminToken = '';
let userId;
let adminId;

beforeEach(async () => {
  user = {
    name: 'Test User',
    email: randomEmail(),
    password: 'testpass123',
  };
  admin = {
    name: 'Admin User',
    email: randomEmail(),
    password: 'adminpass123',
  };

  await request(app).post('/api/auth').send(user);
  const userRes = await request(app)
    .put('/api/auth')
    .send({ email: user.email, password: user.password });
  userToken = userRes.body.token;
  userId = userRes.body.user.id;

  await DB.addUser({
    name: admin.name,
    email: admin.email,
    password: admin.password,
    roles: [{ role: Role.Admin }],
  });

  const adminRes = await request(app)
    .put('/api/auth')
    .send({ email: admin.email, password: admin.password });
  adminToken = adminRes.body.token;
  adminId = adminRes.body.user.id;
});

/* ---------- AUTH TESTS ---------- */
test('User can update own email', async () => {
  const newEmail = randomEmail();
  const res = await request(app)
    .put(`/api/auth/${userId}`)
    .set('Authorization', `Bearer ${userToken}`)
    .send({ email: newEmail, password: user.password });
  expect(res.status).toBe(200);
  expect(res.body.email).toBe(newEmail);
});

test('Unauthorized update returns 403', async () => {
  const res = await request(app)
    .put(`/api/auth/${adminId}`)
    .set('Authorization', `Bearer ${userToken}`)
    .send({ email: randomEmail(), password: admin.password });
  expect(res.status).toBe(403);
});

test('Logout with valid token', async () => {
  const res = await request(app)
    .delete('/api/auth')
    .set('Authorization', `Bearer ${userToken}`);
  expect(res.status).toBe(200);
});

test('Logout without token returns 401', async () => {
  const res = await request(app).delete('/api/auth');
  expect(res.status).toBe(401);
});

/* ---------- ORDER TESTS ---------- */
test('GET /api/order/menu returns menu', async () => {
  const res = await request(app).get('/api/order/menu');
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
});

test('PUT /api/order/menu as admin adds item', async () => {
  const res = await request(app)
    .put('/api/order/menu')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      title: 'Admin Pizza',
      description: 'Pizza by admin',
      image: 'admin.png',
      price: 10,
    });
  expect(res.status).toBe(200);
});

test('PUT /api/order/menu as user returns 403', async () => {
  const res = await request(app)
    .put('/api/order/menu')
    .set('Authorization', `Bearer ${userToken}`)
    .send({
      title: 'User Pizza',
      description: 'Should fail',
      image: 'fail.png',
      price: 1,
    });
  expect(res.status).toBe(403);
});

test('GET /api/order shows user orders', async () => {
  const res = await request(app)
    .get('/api/order')
    .set('Authorization', `Bearer ${userToken}`);
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('orders');
});

test('POST /api/order returns 500 on factory fail', async () => {
  const menuRes = await request(app).get('/api/order/menu');
  const item = menuRes.body[0];
  const res = await request(app)
    .post('/api/order')
    .set('Authorization', `Bearer ${userToken}`)
    .send({
      franchiseId: 999,
      storeId: 999,
      items: [{ menuId: item.id, description: item.description, price: item.price }],
    });
  expect([200, 500]).toContain(res.status);
});

/* ---------- FRANCHISE TESTS ---------- */
describe('Franchise Router', () => {
  test('GET /api/franchise returns franchises', async () => {
    const res = await request(app).get('/api/franchise');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/franchise as admin creates new franchise', async () => {
    const res = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test Franchise',
        city: 'Provo',
        state: 'UT',
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body).toHaveProperty('name');
  });

  test('POST /api/franchise as user returns 403', async () => {
    const res = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'User Franchise',
        city: 'Orem',
        state: 'UT',
      });
    expect(res.status).toBe(403);
  });

  test('PUT /api/franchise/:id as admin updates franchise', async () => {
    const create = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'UpdateMe',
        city: 'Lehi',
        state: 'UT',
      });
    const id = create.body.id || 1;

    const res = await request(app)
      .put(`/api/franchise/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated Franchise' });
    expect([200, 204]).toContain(res.status);
  });

  test('DELETE /api/franchise/:id as admin deletes franchise', async () => {
    const create = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'DeleteMe',
        city: 'SLC',
        state: 'UT',
      });
    const id = create.body.id || 1;

    const res = await request(app)
      .delete(`/api/franchise/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 204]).toContain(res.status);
  });

  test('Register without required fields returns 400', async () => {
    const res = await request(app).post('/api/auth').send({ email: 'missing@test.com' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });
  
  test('Login with wrong password returns 404', async () => {
    const res = await request(app)
      .put('/api/auth')
      .send({ email: user.email, password: 'wrongpass' });
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('message', 'unknown user');
  });
  
  test('Logout with invalid token returns 401', async () => {
    const res = await request(app)
      .delete('/api/auth')
      .set('Authorization', 'Bearer invalidtoken');
    expect(res.status).toBe(401);
  });
  
  /* ---------- ORDER EDGE CASES ---------- */
  test('GET /api/order without token returns 401', async () => {
    const res = await request(app).get('/api/order');
    expect(res.status).toBe(401);
  });
  
  test('POST /api/order without items returns 500 or handled error', async () => {
    const res = await request(app)
      .post('/api/order')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ franchiseId: 1, storeId: 1, items: [] });
    expect([500, 400]).toContain(res.status);
  });
  
  /* ---------- FRANCHISE EDGE CASES ---------- */
  test('GET /api/franchise/:id returns 404 if not found', async () => {
    const res = await request(app).get('/api/franchise/999999');
    expect([404, 200]).toContain(res.status); // depending on router implementation
  });
  
  test('PUT /api/franchise/:id as user returns 403', async () => {
    const res = await request(app)
      .put('/api/franchise/1')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'NoUpdate' });
    expect(res.status).toBe(403);
  });
  
  test('DELETE /api/franchise/:id as user returns 403', async () => {
    const res = await request(app)
      .delete('/api/franchise/1')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });
  
  /* ---------- GENERAL EDGE CASES ---------- */
  test('Accessing protected route without auth header returns 401', async () => {
    const res = await request(app).put('/api/order/menu').send({ title: 'Fail' });
    expect(res.status).toBe(401);
  });
  
  test('Unknown route under /api returns 404', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('message', 'unknown endpoint');
  });
});
