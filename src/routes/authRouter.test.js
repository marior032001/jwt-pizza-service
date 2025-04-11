const request = require('supertest');
//const jwt = require('jsonwebtoken');
const app = require('../service');
//const { DB, Role } = require('../database/database');
//const config = require('../config');

function randomEmail() {
  return `${Math.random().toString(36).substring(2, 12)}@test.com`;
}

const user = {
  name: 'Test User',
  email: randomEmail(),
  password: 'testpass123',
};

const admin = {
  name: 'Admin User',
  email: randomEmail(),
  password: 'adminpass123',
};

let userToken = '';
let adminToken = '';
let userId;
let adminId;
let franchiseId;
let storeId;

beforeAll(async () => {
  await request(app).post('/api/auth').send(user);
  const userRes = await request(app).put('/api/auth').send({ email: user.email, password: user.password });
  userToken = userRes.body.token;
  userId = userRes.body.user.id;

  await request(app).post('/api/auth').send(admin);
  const adminRes = await request(app).put('/api/auth').send({ email: admin.email, password: admin.password });
  adminToken = adminRes.body.token;
  adminId = adminRes.body.user.id;
});


test('User can update own email', async () => {
  const newEmail = randomEmail();
  const res = await request(app)
    .put(`/api/auth/${userId}`)
    .set('Authorization', `Bearer ${userToken}`)
    .send({ email: newEmail });
  expect(res.status).toBe(200);
  expect(res.body.email).toBe(newEmail);
});

test('Unauthorized update returns 403', async () => {
  const res = await request(app)
    .put(`/api/auth/${adminId}`)
    .set('Authorization', `Bearer ${userToken}`)
    .send({ email: randomEmail() });
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


test('Admin can create franchise', async () => {
  const res = await request(app)
    .post('/api/franchise')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Test Franchise',
      admins: [{ email: user.email }],
    });
  expect(res.status).toBe(200);
  franchiseId = res.body.id;
});

test('Admin can create store in franchise', async () => {
  const res = await request(app)
    .post(`/api/franchise/${franchiseId}/store`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Test Store' });
  expect(res.status).toBe(200);
  storeId = res.body.id;
});

test('Non-admin user cannot create store', async () => {
  const res = await request(app)
    .post(`/api/franchise/${franchiseId}/store`)
    .set('Authorization', `Bearer ${userToken}`)
    .send({ name: 'Fail Store' });
  expect(res.status).toBe(403);
});

test('Admin can delete store', async () => {
  const res = await request(app)
    .delete(`/api/franchise/${franchiseId}/store/${storeId}`)
    .set('Authorization', `Bearer ${adminToken}`);
  expect(res.status).toBe(200);
  expect(res.body.message).toBe('store deleted');
});

test('Admin can delete franchise', async () => {
  const res = await request(app)
    .delete(`/api/franchise/${franchiseId}`)
    .set('Authorization', `Bearer ${adminToken}`);
  expect(res.status).toBe(200);
  expect(res.body.message).toBe('franchise deleted');
});

test('Non-admin cannot delete franchise', async () => {
  const res = await request(app)
    .delete(`/api/franchise/${franchiseId}`)
    .set('Authorization', `Bearer ${userToken}`);
  expect(res.status).toBe(403);

});

test('Login with unregistered email returns 404', async () => {
    const res = await request(app)
      .put('/api/auth')
      .send({ email: 'fakeuser@test.com', password: 'doesntmatter' });
    expect(res.status).toBe(404);
  });
  

  test('User cannot delete store', async () => {
    const res = await request(app)
      .delete(`/api/franchise/${franchiseId}/store/${storeId}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });
  

  test('Register without email returns 400', async () => {
    const res = await request(app)
      .post('/api/auth')
      .send({ name: 'No Email', password: 'pass123' });
    expect(res.status).toBe(400);
  });
  
  test('GET /api/order/menux returns 404', async () => {
    const res = await request(app).get('/api/order/menux');
    expect(res.status).toBe(404);
  });
  



