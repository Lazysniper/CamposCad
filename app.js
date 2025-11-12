const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb+srv://igorfilipelima:Cinel2024!@cluster0.yhc6bki.mongodb.net/?appName=Cluster0';
const POSTAL_API_KEY =
  process.env.POSTAL_API_KEY || 'c584c4e5875649f483b1f26dd3d69c54';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1234';
const PAGE_SIZE = Number(process.env.PAGE_SIZE) || 20;

mongoose.set('strictQuery', false);

const uploadsDir = path.join(__dirname, 'uploads');

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }

  const destination = req.originalUrl || '/gestao/codigos';
  return res.redirect(`/login?next=${encodeURIComponent(destination)}`);
}

async function fetchPostalApi(postalCode) {
  if (!/^\d{4}-\d{3}$/.test(postalCode)) {
    return {
      data: null,
      error:
        'O código postal deve estar no formato XXXX-XXX para consultar a API externa.',
    };
  }

  try {
    const response = await fetch(
      `https://www.cttcodigopostal.pt/api/v1/${POSTAL_API_KEY}/${postalCode}`,
    );

    if (!response.ok) {
      return {
        data: null,
        error: `A API devolveu um estado inesperado (${response.status}).`,
      };
    }

    const json = await response.json();

    if (Array.isArray(json) && json.length) {
      return { data: json, error: null };
    }

    return { data: null, error: 'Não existem dados adicionais para este código postal.' };
  } catch (err) {
    console.error('Postal code API error:', err);
    return {
      data: null,
      error: 'Não foi possível obter dados adicionais da API.',
    };
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext).replace(/\s+/g, '_');
    cb(null, `${baseName}_${timestamp}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!file.originalname.match(/\.csv$/i)) {
      return cb(new Error('Please upload a CSV file.'));
    }
    cb(null, true);
  },
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'postal-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60,
    },
  }),
);

app.use((req, res, next) => {
  res.locals.isAdmin = Boolean(req.session && req.session.isAdmin);
  next();
});

app.get('/', (req, res) => {
  res.redirect('/search');
});

app.get('/login', (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.redirect('/gestao/codigos');
  }

  res.render('login', {
    error: null,
    next: req.query.next || '/gestao/codigos',
  });
});

app.post('/login', (req, res) => {
  const username = (req.body.username || '').trim();
  const password = (req.body.password || '').trim();
  const nextUrl = req.body.next || '/gestao/codigos';

  if (username === ADMIN_USER && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect(nextUrl);
  }

  res.status(401).render('login', {
    error: 'Credenciais inválidas. Tente novamente.',
    next: nextUrl,
  });
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

app.get('/search', async (req, res) => {
  const postalCode = (req.query.postalCode || req.query.cp || '').trim();
  let result = null;
  let error = null;
  let apiData = null;
  let apiError = null;
  let notFoundMessage = null;

  if (postalCode) {
    try {
      const collection = mongoose.connection.collection('Locales');
      result = await collection.findOne({ CP: postalCode });

      if (!result) {
        notFoundMessage = `Não encontrámos registos para o código ${postalCode} na base de dados.`;
      }
    } catch (err) {
      console.error('Failed to retrieve document:', err);
      error =
        'Ocorreu um problema ao pesquisar na base de dados. Tente novamente.';
    }

    const { data, error: apiFetchError } = await fetchPostalApi(postalCode);
    apiData = data;
    if (apiFetchError) {
      apiError = apiFetchError;
    }
  }

  res.render('search', {
    postalCode,
    result,
    error,
    apiData,
    apiError,
    notFoundMessage,
  });
});

app.get('/upload', (req, res) => {
  res.render('upload', { message: null, error: null });
});

app.post('/upload', upload.single('csvFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).render('upload', {
      message: null,
      error: 'Nenhum ficheiro enviado. Selecione um ficheiro CSV.',
    });
  }

  const records = [];

  fs.createReadStream(req.file.path)
    .pipe(
      csv({
        separator: ';',
        mapHeaders: ({ header }) => header.trim().toUpperCase(),
        mapValues: ({ value }) => value.trim(),
      }),
    )
    .on('data', (data) => {
      const cleaned = Object.entries(data).reduce((acc, [key, value]) => {
        if (!key) {
          return acc;
        }
        acc[key] = value;
        return acc;
      }, {});

      if (Object.values(cleaned).some((val) => val !== '')) {
        records.push(cleaned);
      }
    })
    .on('end', async () => {
      try {
        if (!records.length) {
          return res.render('upload', {
            message: null,
            error: 'O ficheiro CSV está vazio.',
          });
        }

        const collection = mongoose.connection.collection('Locales');
        await collection.insertMany(records);

        fs.unlink(req.file.path, () => {});

        res.render('upload', {
          message: `Foram inseridos ${records.length} registos na base de dados.`,
          error: null,
        });
      } catch (err) {
        console.error('Failed to insert documents:', err);
        res.status(500).render('upload', {
          message: null,
          error:
            'Falha ao inserir os registos na base de dados. Verifique os logs do servidor.',
        });
      }
    })
    .on('error', (err) => {
      console.error('Failed to read CSV:', err);
      res.status(500).render('upload', {
        message: null,
        error: 'Não foi possível ler o ficheiro CSV. Tente novamente.',
      });
    });
});

app.get('/gestao/codigos', requireAdmin, async (req, res) => {
  const postalCode = (req.query.postalCode || '').trim();
  const filterLocalidade = (req.query.localidade || '').trim();
  const filterPrefix = (req.query.prefixo || '').trim();
  const filterSabado = (req.query.sabado || '').trim().toUpperCase();
  const currentPage = Math.max(parseInt(req.query.pagina, 10) || 1, 1);
  const collection = mongoose.connection.collection('Locales');

  let dbRecord = null;
  let dbRecordId = null;
  let apiData = null;
  let apiError = null;
  let notFoundMessage = null;

  if (postalCode) {
    dbRecord = await collection.findOne({ CP: postalCode });

    if (!dbRecord) {
      notFoundMessage = `Não existe nenhum registo com o código ${postalCode}. Pode criar um novo abaixo.`;
    } else {
      dbRecordId = dbRecord._id ? dbRecord._id.toString() : null;
    }

    const { data, error } = await fetchPostalApi(postalCode);
    apiData = data;
    apiError = error;
  }

  const primaryApiEntry = apiData && apiData.length ? apiData[0] : null;

  const formValues = {
    CP: postalCode || '',
    LOCALIDADE:
      (dbRecord && dbRecord.LOCALIDADE) ||
      (primaryApiEntry && primaryApiEntry.localidade) ||
      '',
    GIRO: (dbRecord && dbRecord.GIRO) || '',
    CENTRO: (dbRecord && dbRecord.CENTRO) || '',
    SABADO: (dbRecord && dbRecord.SABADO) || '',
  };

  const matchFilter = {};
  if (filterLocalidade) {
    matchFilter.LOCALIDADE = { $regex: new RegExp(filterLocalidade, 'i') };
  }
  if (filterPrefix) {
    matchFilter.CP = { $regex: new RegExp(`^${filterPrefix}`) };
  }
  if (filterSabado === 'S' || filterSabado === 'N') {
    matchFilter.SABADO = filterSabado;
  }

  const listQuery = {
    ...(Object.keys(matchFilter).length ? { $and: Object.entries(matchFilter).map(([key, value]) => ({ [key]: value })) } : {}),
  };

  const totalCount = await collection.countDocuments(listQuery);
  const totalPages = Math.max(Math.ceil(totalCount / PAGE_SIZE), 1);
  const safePage = Math.min(currentPage, totalPages);

  const localesList = await collection
    .find(listQuery)
    .project({ CP: 1, LOCALIDADE: 1, SABADO: 1, GIRO: 1 })
    .sort({ CP: 1 })
    .skip((safePage - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .toArray();

  res.render('manage', {
    postalCode,
    formValues,
    dbRecord,
    dbRecordId,
    apiData,
    apiError,
    notFoundMessage,
    message: req.query.message || null,
    filters: {
      localidade: filterLocalidade,
      prefixo: filterPrefix,
      sabado: filterSabado,
    },
    pagination: {
      page: safePage,
      totalPages,
      pageSize: PAGE_SIZE,
      totalCount,
    },
    localesList,
    error: null,
  });
});

app.post('/gestao/codigos', requireAdmin, async (req, res) => {
  const collection = mongoose.connection.collection('Locales');

  const cp = (req.body.cp || '').trim();
  const localidade = (req.body.localidade || '').trim();
  const giro = (req.body.giro || '').trim();
  const centro = (req.body.centro || '').trim();
  const sabadoRaw = (req.body.sabado || '').trim().toUpperCase();

  if (!cp) {
    return res.status(400).render('manage', {
      postalCode: cp,
      formValues: {
        CP: cp,
        LOCALIDADE: localidade,
        GIRO: giro,
        CENTRO: centro,
        SABADO: sabadoRaw,
      },
      dbRecord: null,
      dbRecordId: null,
      apiData: null,
      apiError: null,
      notFoundMessage: null,
      message: null,
      error: 'O campo Código Postal é obrigatório.',
    });
  }

  if (sabadoRaw && !['S', 'N'].includes(sabadoRaw)) {
    const { data, error } = await fetchPostalApi(cp);
    return res.status(400).render('manage', {
      postalCode: cp,
      formValues: {
        CP: cp,
        LOCALIDADE: localidade,
        GIRO: giro,
        CENTRO: centro,
        SABADO: sabadoRaw,
      },
      dbRecord: null,
      apiData: data,
      apiError: error,
      notFoundMessage: null,
      message: null,
      error: 'Introduza S para Sim ou N para Não no campo Sábado.',
    });
  }

  const sabado = sabadoRaw || '';

  try {
    await collection.updateOne(
      { CP: cp },
      {
        $set: {
          CP: cp,
          LOCALIDADE: localidade,
          GIRO: giro,
          CENTRO: centro,
          SABADO: sabado || sabadoRaw || '',
        },
      },
      { upsert: true },
    );

    const dbRecord = await collection.findOne({ CP: cp });
    const { data, error } = await fetchPostalApi(cp);

    const dbRecordId = dbRecord && dbRecord._id ? dbRecord._id.toString() : null;

    res.render('manage', {
      postalCode: cp,
      formValues: {
        CP: cp,
        LOCALIDADE: dbRecord.LOCALIDADE || '',
        GIRO: dbRecord.GIRO || '',
        CENTRO: dbRecord.CENTRO || '',
        SABADO: dbRecord.SABADO || '',
      },
      dbRecord,
      dbRecordId,
      apiData: data,
      apiError: error,
      notFoundMessage: null,
      message: 'Registo guardado com sucesso.',
      error: null,
    });
  } catch (err) {
    console.error('Erro ao guardar registo:', err);

    const { data, error } = await fetchPostalApi(cp);
    res.status(500).render('manage', {
      postalCode: cp,
      formValues: {
        CP: cp,
        LOCALIDADE: localidade,
        GIRO: giro,
        CENTRO: centro,
        SABADO: sabado || sabadoRaw || '',
      },
      dbRecord: null,
      dbRecordId: null,
      apiData: data,
      apiError: error,
      notFoundMessage: null,
      message: null,
      error: 'Não foi possível guardar o registo. Tente novamente.',
    });
  }
});

async function startServer() {
  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: 'Cadilhes',
    });
    console.log('Connected to MongoDB');

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
}

startServer();

