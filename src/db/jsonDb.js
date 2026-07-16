const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

// Simple Lock to prevent concurrent write collisions on the same JSON files
const fileLocks = {};

async function acquireLock(filePath) {
  while (fileLocks[filePath]) {
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  fileLocks[filePath] = true;
}

function releaseLock(filePath) {
  fileLocks[filePath] = false;
}

class Collection {
  constructor(name) {
    this.name = name;
    this.filePath = path.join(DATA_DIR, `${name}.json`);
  }

  async _read() {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const data = await fs.readFile(this.filePath, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return [];
      }
      throw err;
    }
  }

  async _write(data) {
    await acquireLock(this.filePath);
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf8');
    } finally {
      releaseLock(this.filePath);
    }
  }

  async find(query = {}) {
    const data = await this._read();
    return data.filter(item => {
      for (const key in query) {
        if (item[key] !== query[key]) return false;
      }
      return true;
    });
  }

  async findOne(query = {}) {
    const data = await this._read();
    return data.find(item => {
      for (const key in query) {
        if (item[key] !== query[key]) return false;
      }
      return true;
    }) || null;
  }

  async findById(id) {
    const data = await this._read();
    return data.find(item => item.id === id) || null;
  }

  async insert(doc) {
    const data = await this._read();
    const newDoc = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 7),
      createdAt: new Date().toISOString(),
      ...doc
    };
    data.push(newDoc);
    await this._write(data);
    return newDoc;
  }

  async updateOne(query, updates) {
    const data = await this._read();
    const index = data.findIndex(item => {
      for (const key in query) {
        if (item[key] !== query[key]) return false;
      }
      return true;
    });

    if (index === -1) return null;
    
    data[index] = {
      ...data[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    await this._write(data);
    return data[index];
  }

  async updateMany(query, updates) {
    const data = await this._read();
    let updatedCount = 0;
    const updatedData = data.map(item => {
      let matches = true;
      for (const key in query) {
        if (item[key] !== query[key]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        updatedCount++;
        return {
          ...item,
          ...updates,
          updatedAt: new Date().toISOString()
        };
      }
      return item;
    });
    if (updatedCount > 0) {
      await this._write(updatedData);
    }
    return updatedCount;
  }
}

module.exports = {
  users: new Collection('users'),
  donations: new Collection('donations'),
  requests: new Collection('requests')
};
