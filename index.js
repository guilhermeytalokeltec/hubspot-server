require("dotenv").config();

const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const cors = require("cors"); 

const app = express();
const PORT = process.env.PORT || 3000;

const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;
const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY || "d149cafdcc28478197353609e2d822a3";

app.use(cors({
    origin: ["http://localhost:3000", "http://localhost:5173", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001", "https://app.hubspot.com"],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(bodyParser.json());

// Rota para obter informações de um contato específico
app.get("/contact-info/:contactId", async (req, res) => {
    try {
        const { contactId } = req.params;

        const contactResponse = await axios.get(
            `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=zip,city,firstname,lastname`,
            {
                headers: {
                    Authorization: `Bearer ${HUBSPOT_TOKEN}`,
                },
            }
        );

        res.json({
            success: true,
            contact: contactResponse.data
        });
    } catch (err) {
        console.error("Erro ao buscar informações do contato:", err.message);
        res.status(500).json({
            error: err.message,
            stack: err.stack
        });
    }
});

// Rota para teste manual da geocodificação
app.get("/geocode", async (req, res) => {
    try {
        const { postcode, country = "US" } = req.query;

        if (!postcode) {
            return res
                .status(400)
                .json({ error: "Você precisa passar ?postcode=XXXX" });
        }

        const geo = await axios.get(
            `https://api.geoapify.com/v1/geocode/search` +
            `?postcode=${encodeURIComponent(postcode)}` +
            `&country=${encodeURIComponent(country)}` +
            `&format=json&apiKey=${GEOAPIFY_API_KEY}`
        );

        const city = geo.data.results?.[0]?.city;

        return res.json({
            postcode,
            country,
            city: city || null,
            raw: geo.data,
        });
    } catch (err) {
        console.error("Erro na geocodificação:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Rota para atualizar o CEP de um contato
app.post("/update-zip/:contactId", async (req, res) => {
    try {
        const { contactId } = req.params;
        const { zip } = req.body;

        if (!zip) {
            return res.status(400).json({ error: "ZIP/CEP não informado no corpo da requisição" });
        }

        await axios.patch(
            `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
            {
                properties: {
                    zip: zip,
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${HUBSPOT_TOKEN}`,
                    "Content-Type": "application/json",
                }
            }
        );

        const contactResponse = await axios.get(
            `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=zip,firstname,lastname`,
            {
                headers: {
                    Authorization: `Bearer ${HUBSPOT_TOKEN}`,
                },
            }
        );

        return res.json({
            success: true,
            message: `CEP atualizado para o contato ${contactId}`,
            contact: contactResponse.data
        });

    } catch (err) {
        console.error("Erro ao atualizar CEP:", err.message);
        res.status(500).json({
            error: err.message,
            stack: err.stack
        });
    }
});

// Rota para atualizar manualmente a cidade com base no CEP
app.get("/update-city/:contactId", async (req, res) => {
    try {
        const { contactId } = req.params;

        const contactResponse = await axios.get(
            `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=zip`,
            {
                headers: {
                    Authorization: `Bearer ${HUBSPOT_TOKEN}`,
                },
            }
        );

    const zip = contactResponse.data.properties?.zip;

        if (!zip) {
            return res.status(404).json({
                error: "CEP não encontrado para este contato",
                contact: contactResponse.data
            });
        }
    const geoResponse = await axios.get(
      `https://api.geoapify.com/v1/geocode/search?postcode=${zip}&country=US&format=json&apiKey=${GEOAPIFY_API_KEY}`
    );

    const result = geoResponse.data.results?.[0];
    if (!result) {
      return res.status(404).json({ error: "Endereço não encontrado na Geoapify." });
    }

    const city = result.city || result.county || result.state;

    if (!city) {
      return res.status(404).json({
        error: "Cidade não encontrada para este CEP.",
        zip,
        geoResponse: result,
      });
    }

    await axios.patch(
      `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
      {
        properties: { city },
      },
      {
        headers: {
          Authorization: `Bearer ${HUBSPOT_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({
      success: true,
      contactId,
      zip,
      city,
      message: `Contato ${contactId} atualizado com cidade: ${city}`,
    });
  } catch (err) {
    console.error("Erro ao atualizar cidade:", err.message);
    res.status(500).json({ error: "Erro interno", detail: err.message });
  }
});

// Webhook para receber eventos do HubSpot
app.post("/webhook", async (req, res) => {
    try {
        const events = req.body;
        console.log("Eventos recebidos:", JSON.stringify(events, null, 2));

        for (const event of events) {
            if (
                event.propertyName === "zip" &&
                event.subscriptionType === "contact.propertyChange"
            ) {
                const contactId = event.objectId;
                console.log(`Processando atualização para contato ID: ${contactId}`);

                try {
                    const contactResponse = await axios.get(
                        `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=zip`,
                        {
                            headers: {
                                Authorization: `Bearer ${HUBSPOT_TOKEN}`,
                            },
                        }
                    );

                    const zip = contactResponse.data.properties.zip;
                    console.log(`CEP encontrado para contato ${contactId}: ${zip}`);

                    if (!zip) {
                        console.log(`CEP não definido para contato ${contactId}`);
                        continue;
                    }

                    const geoResponse = await axios.get(
                        `https://api.geoapify.com/v1/geocode/search?postcode=${encodeURIComponent(zip)}&country=US&format=json&apiKey=${GEOAPIFY_API_KEY}`
                    );

                    const city = geoResponse.data.results?.[0]?.city;
                    console.log(`Cidade encontrada para CEP ${zip}: ${city}`);

                    if (!city) {
                        console.log(`Cidade não encontrada para CEP ${zip}`);
                        continue;
                    }

                    await axios.patch(
                        `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
                        {
                            properties: {
                                city: city,
                            }
                        },
                        {
                            headers: {
                                Authorization: `Bearer ${HUBSPOT_TOKEN}`,
                                "Content-Type": "application/json",
                            }
                        }
                    );

                    console.log(`Contato ${contactId} atualizado com cidade: ${city}`);
                } catch (contactError) {
                    console.error(`Erro processando contato ${contactId}:`, contactError.message);
                }
            }
        }

        res.sendStatus(200);
    } catch (error) {
        console.error("Erro no webhook:", error.message);
        res.sendStatus(500);
    }
});

// Rota para listar contatos (para debugging)
app.get("/list-contacts", async (req, res) => {
    try {
        const response = await axios.get(
            "https://api.hubapi.com/crm/v3/objects/contacts?properties=zip,city,firstname,lastname&limit=10",
            {
                headers: {
                    Authorization: `Bearer ${HUBSPOT_TOKEN}`,
                }
            }
        );

        res.json(response.data);
    } catch (err) {
        console.error("Erro ao listar contatos:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});