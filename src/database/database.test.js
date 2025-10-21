const { DB, Role } = require('./database.js');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const { StatusCodeError } = require('../endpointHelper.js');

jest.mock('mysql2/promise');
jest.mock('bcrypt');

describe('DB class', () => {
  let db;
  let mockConnection;

  beforeEach(async () => {
    db = new DB();

    mockConnection = {
      execute: jest.fn(),
      query: jest.fn(),
      end: jest.fn(),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
    };

    mysql.createConnection.mockResolvedValue(mockConnection);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('getMenu returns menu items', async () => {
    mockConnection.execute.mockResolvedValue([[{ id: 1, title: 'Pizza' }]]);
    const result = await db.getMenu();
    expect(result).toEqual([{ id: 1, title: 'Pizza' }]);
  });

  test('addMenuItem inserts a menu item', async () => {
    mockConnection.execute.mockResolvedValue([{ insertId: 42 }]);
    const item = { title: 'Veggie', description: 'Yum', image: 'veggie.png', price: 9.99 };
    const result = await db.addMenuItem(item);
    expect(result).toEqual({ ...item, id: 42 });
  });

  test('addUser hashes password and inserts user', async () => {
    bcrypt.hash.mockResolvedValue('hashedpass');
    mockConnection.execute.mockResolvedValue([{ insertId: 10 }]);
    
    const user = { name: 'John', email: 'a@test.com', password: 'pass', roles: [{ role: Role.Admin }] };
    const result = await db.addUser(user);
    
    expect(bcrypt.hash).toHaveBeenCalledWith('pass', 10);
    expect(result.id).toBe(10);
    expect(result.password).toBeUndefined();
  });

  test('getUser throws for unknown email', async () => {
    mockConnection.execute.mockResolvedValue([[]]);
    await expect(db.getUser('unknown@test.com')).rejects.toThrow(StatusCodeError);
  });

  test('updateUser updates fields and calls getUser', async () => {
    db.getUser = jest.fn().mockResolvedValue({ id: 1, email: 'new@test.com' });
    bcrypt.hash.mockResolvedValue('hashedpass');
    mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }]);
    
    const result = await db.updateUser(1, 'New Name', 'new@test.com', 'newpass');
    expect(result.email).toBe('new@test.com');
  });

  test('loginUser inserts token', async () => {
    mockConnection.execute.mockResolvedValue({});
    await db.loginUser(1, 'token');
    expect(mockConnection.execute).toHaveBeenCalled();
  });

  test('logoutUser deletes token', async () => {
    mockConnection.execute.mockResolvedValue({});
    await db.logoutUser('token');
    expect(mockConnection.execute).toHaveBeenCalledWith(expect.any(String), ['token']);
  });

  test('getOffset calculates offset', () => {
    expect(db.getOffset(3, 10)).toEqual(20);
  });

  test('getTokenSignature extracts token part', () => {
    const token = 'abc.def.ghi';
    expect(db.getTokenSignature(token)).toBe('ghi');
  });
});
