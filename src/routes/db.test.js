const { DB } = require('../database/database');
//const { StatusCodeError } = require('../endpointHelper');

const mockConnection = {
  execute: jest.fn(),
  query: jest.fn(),
  end: jest.fn(),
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
};

jest.spyOn(DB, '_getConnection').mockResolvedValue(mockConnection);
jest.spyOn(DB, 'getID').mockResolvedValue(1);

describe('DB core methods', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getOrders returns formatted orders with items', async () => {
    mockConnection.execute
      .mockResolvedValueOnce([[{ id: 1, franchiseId: 1, storeId: 2, date: new Date() }]]) 
      .mockResolvedValueOnce([[{ id: 99, menuId: 1, description: 'Cheese', price: 8.0 }]]); 

    const user = { id: 1 };
    const result = await DB.getOrders(user, 1);

    expect(result.dinerId).toBe(1);
    expect(result.orders[0].items).toBeDefined();
    expect(mockConnection.execute).toHaveBeenCalledTimes(2);
  });

  test('addDinerOrder inserts order and items', async () => {
    mockConnection.execute
      .mockResolvedValueOnce([{ insertId: 5 }]) 
      .mockResolvedValueOnce([[{ id: 1 }]]);   

    const order = {
      franchiseId: 1,
      storeId: 1,
      items: [{ menuId: 1, description: 'Test pizza', price: 9.99 }],
    };

    const result = await DB.addDinerOrder({ id: 2 }, order);
    expect(result.id).toBe(5);
    expect(mockConnection.execute).toHaveBeenCalledTimes(2);
  });

  test('createFranchise successfully inserts franchise and roles', async () => {
    mockConnection.execute
      .mockResolvedValueOnce([[{ id: 10, name: 'Admin User' }]]) 
      .mockResolvedValueOnce([{ insertId: 123 }])                
      .mockResolvedValueOnce([]);                               
    const data = {
      name: 'Test Franchise',
      admins: [{ email: 'admin@pizza.com' }],
    };

    const result = await DB.createFranchise(data);
    expect(result.id).toBe(123);
    expect(mockConnection.execute).toHaveBeenCalledTimes(3);
  });

  test('createFranchise fails if admin not found', async () => {
    mockConnection.execute.mockResolvedValueOnce([[]]); 

    await expect(DB.createFranchise({
      name: 'Ghost Franchise',
      admins: [{ email: 'ghost@unknown.com' }],
    })).rejects.toThrow('unknown user');
  });

  test('deleteFranchise commits if deletion succeeds', async () => {
    mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }]);

    await DB.deleteFranchise(999);
    expect(mockConnection.beginTransaction).toHaveBeenCalled();
    expect(mockConnection.commit).toHaveBeenCalled();
  });

  test('deleteFranchise rolls back if error thrown', async () => {
    mockConnection.execute
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockRejectedValueOnce(new Error('fail'));

    await expect(DB.deleteFranchise(999)).rejects.toThrow('unable to delete franchise');
    expect(mockConnection.rollback).toHaveBeenCalled();
  });

  test('createStore inserts and returns store object', async () => {
    mockConnection.execute.mockResolvedValueOnce([{ insertId: 77 }]);
  
    const result = await DB.createStore(5, { name: 'SLC Store' });
    expect(result).toEqual({ id: 77, franchiseId: 5, name: 'SLC Store' });
    expect(mockConnection.execute).toHaveBeenCalledWith(
      'INSERT INTO store (franchiseId, name) VALUES (?, ?)',
      [5, 'SLC Store']
    );
  });
  
  test('deleteStore executes delete query', async () => {
    mockConnection.execute.mockResolvedValueOnce([]);
  
    await DB.deleteStore(10, 25);
    expect(mockConnection.execute).toHaveBeenCalledWith(
      'DELETE FROM store WHERE franchiseId=? AND id=?',
      [10, 25]
    );
  });
  
  test('getOffset returns correct pagination offset', () => {
    const result = DB.getOffset(3, 10); 
    expect(result).toEqual(20); 
  });
  
  
});
