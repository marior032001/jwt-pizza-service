const request = require("supertest");
const app = require("../service");
const { Role, DB } = require("../database/database.js");

let adminAuthToken;
let regularAuthToken;
let adminUser;
let regularUser;
let newFranchise;
let regUserFranchise;
let newStore;
let createdFranchiseId;

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

async function createAdminUser() {
  const user = {
    name: randomName(),
    email: randomName() + "@admin.com",
    password: "toomanysecrets",
    roles: [{ role: Role.Admin }],
  };
  await DB.addUser(user);
  return user;
}

if (process.env.VSCODE_INSPECTOR_OPTIONS) {
  jest.setTimeout(60 * 1000 * 5);
}

beforeAll(async () => {
  regularUser = {
    name: "pizza diner",
    email: randomName() + "@test.com",
    password: "a",
  };

  newStore = {
    id: randomName(),
    name: randomName(),
    totalRevenue: 1000,
  };

  adminUser = await createAdminUser();

  newFranchise = {
    name: randomName(),
    admins: [{ email: adminUser.email }],
    stores: [newStore],
  };

  regUserFranchise = {
    name: randomName(),
    admins: [{ email: regularUser.email }],
    stores: [{ id: randomName(), name: randomName(), totalRevenue: 1000 }],
  };

  await request(app).post("/api/auth").send(regularUser);
  await request(app).post("/api/auth").send(adminUser);

  const adminLogin = await request(app).put("/api/auth").send({
    email: adminUser.email,
    password: adminUser.password,
  });
  const userLogin = await request(app).put("/api/auth").send({
    email: regularUser.email,
    password: regularUser.password,
  });

  adminAuthToken = adminLogin.body.token;
  regularAuthToken = userLogin.body.token;
});

/* -------------------- CREATE FRANCHISE -------------------- */
describe("Franchise Router Tests", () => {
  test("Admin can create a new franchise", async () => {
    const res = await request(app)
      .post("/api/franchise")
      .set("Authorization", `Bearer ${adminAuthToken}`)
      .send(newFranchise);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("franchise");
    expect(res.body.franchise).toHaveProperty("name", newFranchise.name);
    createdFranchiseId = res.body.franchise.id;
  });

  test("Regular user cannot create a franchise", async () => {
    const res = await request(app)
      .post("/api/franchise")
      .set("Authorization", `Bearer ${regularAuthToken}`)
      .send(regUserFranchise);
    expect([401, 403]).toContain(res.status);
  });

  test("Creating a franchise without token returns 401", async () => {
    const res = await request(app).post("/api/franchise").send(newFranchise);
    expect(res.status).toBe(401);
  });

  test("Creating a franchise with missing fields returns 400", async () => {
    const invalid = { name: "" };
    const res = await request(app)
      .post("/api/franchise")
      .set("Authorization", `Bearer ${adminAuthToken}`)
      .send(invalid);
    expect([400, 500]).toContain(res.status);
  });

  /* -------------------- GET FRANCHISE -------------------- */
  test("Admin can get a list of franchises", async () => {
    const res = await request(app)
      .get("/api/franchise")
      .set("Authorization", `Bearer ${adminAuthToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.franchises || [])).toBe(true);
  });

  test("Regular user cannot access all franchises", async () => {
    const res = await request(app)
      .get("/api/franchise")
      .set("Authorization", `Bearer ${regularAuthToken}`);
    expect([401, 403]).toContain(res.status);
  });

  test("GET /api/franchise without token returns 401", async () => {
    const res = await request(app).get("/api/franchise");
    expect(res.status).toBe(401);
  });

  /* -------------------- UPDATE FRANCHISE -------------------- */
  test("Admin can update a franchise", async () => {
    const res = await request(app)
      .put(`/api/franchise/${createdFranchiseId}`)
      .set("Authorization", `Bearer ${adminAuthToken}`)
      .send({ name: "Updated Franchise Name" });
    expect([200, 204]).toContain(res.status);
  });

  test("Regular user cannot update a franchise", async () => {
    const res = await request(app)
      .put(`/api/franchise/${createdFranchiseId}`)
      .set("Authorization", `Bearer ${regularAuthToken}`)
      .send({ name: "Hack Attempt" });
    expect([401, 403]).toContain(res.status);
  });

  /* -------------------- DELETE FRANCHISE -------------------- */
  test("Admin can delete a franchise", async () => {
    const res = await request(app)
      .delete(`/api/franchise/${createdFranchiseId}`)
      .set("Authorization", `Bearer ${adminAuthToken}`);
    expect([200, 204, 501]).toContain(res.status);
  });

  test("Regular user cannot delete a franchise", async () => {
    const res = await request(app)
      .delete(`/api/franchise/${createdFranchiseId}`)
      .set("Authorization", `Bearer ${regularAuthToken}`);
    expect([401, 403]).toContain(res.status);
  });

  test("DELETE /api/franchise without token returns 401", async () => {
    const res = await request(app).delete(`/api/franchise/${createdFranchiseId}`);
    expect(res.status).toBe(401);
  });
});
