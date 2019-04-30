const alexa = require('ask-sdk');
const dex = require('./pokemon');

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  handle(handlerInput) {
    const speechText = 'Bienvenido entrenador, tengo 809 Pokémon registrados, prueba pidiendo uno por nombre, número o tipo';
    const repromptText = 'Prueba pidiendo un pokemon por nombre, número o tipo';

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(repromptText)
      .withSimpleCard('', speechText)
      .getResponse();
  },
};

const GetPokemonIntentHandler = {
  canHandle(handlerInput) {
    const { request } = handlerInput.requestEnvelope;

    return request.type === 'IntentRequest' && request.intent.name === 'SearchPokemonIntent';
  },
  async handle(handlerInput) {
    const currentIntentSlots = handlerInput.requestEnvelope.request.intent.slots;
    const selected = await parseSlots(currentIntentSlots);
    let pokemonData;

    switch (selected.name) {
      case 'name':
        pokemonData = await getPokemonDataByName(selected.value);
        break;
      case 'number':
        pokemonData = await getPokemonDataByID(selected.value);
        break;
      case 'type':
        pokemonData = await getPokemonDataByType(selected.value);
        break;
      default:
        break;
    }

    let smallImage;
    let speechText;

    if (selected.name === 'type' && pokemonData) {
      const index = Math.floor(Math.random() * pokemonData.length);
      const randomSelected = pokemonData[index];
      pokemonData.splice(index, 1);

      handlerInput.attributesManager.setSessionAttributes({
        current: randomSelected, typeGroup: pokemonData,
      });

      const types = randomSelected.types.length > 0 ? randomSelected.types.join('/') : randomSelected.types;
      smallImage = randomSelected.evolutions.find(elem => elem.name === randomSelected.name);
      speechText = `${randomSelected.name}, Pokemon ${randomSelected.category}, Tipo ${types}, ${randomSelected.description}, quieres escuchar mas datos?`;

      if (await supportsDisplay(handlerInput)) {
        handlerInput.responseBuilder.withStandardCard(`#${randomSelected.id} ${randomSelected.name}`, randomSelected.description, smallImage, randomSelected.image);
      } else {
        handlerInput.responseBuilder.withSimpleCard(`#${randomSelected.id} ${randomSelected.name}`, randomSelected.description);
      }
    } else {
      handlerInput.attributesManager.setSessionAttributes({
        current: pokemonData, typeGroup: [],
      });

      const types = pokemonData.types.length > 0 ? pokemonData.types.join(' ') : pokemonData.types;
      smallImage = pokemonData.evolutions.find(elem => elem.name === pokemonData.name);
      speechText = `${pokemonData.name}, Pokemon ${pokemonData.category}, Tipo ${types}, ${pokemonData.description} quieres escuchar mas datos?`;

      if (await supportsDisplay(handlerInput)) {
        handlerInput.responseBuilder.withStandardCard(`#${pokemonData.id} ${pokemonData.name}`, pokemonData.description, smallImage, pokemonData.image);
      } else {
        handlerInput.responseBuilder.withSimpleCard(`#${pokemonData.id} ${pokemonData.name}`, pokemonData.description);
      }
    }

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt('quieres escuchar mas datos?')
      .getResponse();
  },
};

const YesIntentHandler = {
  async canHandle(handlerInput) {
    const { request } = handlerInput.requestEnvelope;
    const sessionData = await getSessionData(handlerInput);

    return sessionData.current
      && (request.type === 'IntentRequest' && request.intent.name === 'AMAZON.YesIntent');
  },
  async handle(handlerInput) {
    const sessionData = await getSessionData(handlerInput);
    const { current } = sessionData;
    let evolutionText = ', este pokemon no tiene evolucion';

    if (current.evolutions.length > 0
      && current.evolutions[current.evolutions.length - 1].name !== current.name) {
      // Delete pokemon before unless its first
      const idx = current.evolutions.findIndex(el => el.name === current.name);
      if (idx > 0) {
        current.evolutions.splice(idx - 1, 1);
      }

      // Map evolutions, remove the current and just return name
      const evolutionsArr = current.evolutions
        .filter(element => element.name !== current.name)
        .map(evo => evo.name);
      evolutionText = `, Sus evoluciones son ${evolutionsArr.join(', ').replace(/, ([^,]*)$/, ' y $1')}`;
    }

    const finalMessage = sessionData.typeGroup && sessionData.typeGroup.length > 1 ? ', Di siguiente si quieres ir al proximo Pokémon' : '';
    const speechText = `${current.name}, sus debilidades son ${current.weakness.join(', ').replace(/, ([^,]*)$/, ' y $1')} ${evolutionText} ${finalMessage}`;
    if (sessionData.typeGroup && sessionData.typeGroup.length > 1) {
      handlerInput.responseBuilder.reprompt('Di siguiente si quieres ir al proximo Pokémon');
    }

    return handlerInput.responseBuilder
      .speak(speechText)
      .getResponse();
  },
};

const NoIntentHandler = {
  async canHandle(handlerInput) {
    const { request } = handlerInput.requestEnvelope;
    const sessionData = await getSessionData(handlerInput);

    return sessionData.current
      && (request.type === 'IntentRequest' && request.intent.name === 'AMAZON.NoIntent');
  },
  handle(handlerInput) {
    const speechText = 'Cerrando Pokédex';

    return handlerInput.responseBuilder
      .speak(speechText)
      .withShouldEndSession(true)
      .getResponse();
  },
};

const NextIntentHandler = {
  async canHandle(handlerInput) {
    const { request } = handlerInput.requestEnvelope;
    const sessionData = await getSessionData(handlerInput);

    return sessionData.current && sessionData.typeGroup.length > 1
      && (request.type === 'IntentRequest' && request.intent.name === 'AMAZON.NextIntent');
  },
  async handle(handlerInput) {
    const sessionData = await getSessionData(handlerInput);
    const pokemonData = sessionData.typeGroup;

    const index = Math.floor(Math.random() * pokemonData.length);
    const randomSelected = pokemonData[index];
    pokemonData.splice(index, 1);

    handlerInput.attributesManager.setSessionAttributes({
      current: randomSelected, typeGroup: pokemonData,
    });

    const types = randomSelected.types.length > 0 ? randomSelected.types.join('/') : randomSelected.types;
    const smallImage = randomSelected.evolutions.find(elem => elem.name === randomSelected.name);
    const speechText = `${randomSelected.name}, Pokemon ${randomSelected.category}, Tipo ${types}, ${randomSelected.description}, quieres escuchar mas datos?`;

    if (await supportsDisplay(handlerInput)) {
      handlerInput.responseBuilder.withStandardCard(`#${randomSelected.id} ${randomSelected.name}`, randomSelected.description, smallImage, randomSelected.image);
    } else {
      handlerInput.responseBuilder.withSimpleCard(`#${randomSelected.id} ${randomSelected.name}`, randomSelected.description);
    }

    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard('', speechText)
      .reprompt('quieres escuchar mas datos?')
      .getResponse();
  },
};

/* HELPERS */

async function parseSlots(slots) {
  let results = {};

  Object.keys(slots).forEach((item) => {
    const currentSlot = slots[item];

    if (currentSlot
      && currentSlot.resolutions
      && currentSlot.resolutions.resolutionsPerAuthority[0]
      && currentSlot.resolutions.resolutionsPerAuthority[0].status.code
      && currentSlot.resolutions.resolutionsPerAuthority[0].status.code === 'ER_SUCCESS_MATCH') {
      results = { name: currentSlot.name, value: currentSlot.resolutions.resolutionsPerAuthority[0].values[0].value.name};
    }

    if (currentSlot.name === 'number' && currentSlot.value) {
      results = { name: currentSlot.name, value: currentSlot.value };
    }
  });

  return results;
}

async function getPokemonDataByName(name) {
  return dex.spanish.find(pokemon => pokemon.name.toLowerCase() === name.toLowerCase());
}

async function getPokemonDataByID(id) {
  return dex.spanish.find(pokemon => pokemon.id === id);
}

async function getPokemonDataByType(type) {
  const results = [];

  dex.spanish.forEach((pokemon) => {
    if (results.length < 10 && pokemon.types.find(element => element.toLowerCase() === type.toLowerCase())) {
      results.push(pokemon);
    }
  });

  return results;
}

const getSessionAttributesHelper = {
  async process(handlerInput) {
    const sessionAttributes = await handlerInput.attributesManager.getSessionAttributes();

    // Check if user is invoking the skill the first time and initialize preset values
    if (Object.keys(sessionAttributes).length === 0) {
      handlerInput.attributesManager.setSessionAttributes({
        current: {}, typeGroup: [],
      });
    }
  },
};

async function getSessionData(handlerInput) {
  const sessionAttributes = await handlerInput.attributesManager.getSessionAttributes();
  return sessionAttributes;
}

function supportsDisplay(handlerInput) {
  const hasDisplay = handlerInput.requestEnvelope.context
    && handlerInput.requestEnvelope.context.System
    && handlerInput.requestEnvelope.context.System.device
    && handlerInput.requestEnvelope.context.System.device.supportedInterfaces
    && handlerInput.requestEnvelope.context.System.device.supportedInterfaces.Display;

  return hasDisplay;
}

/* BUILT-IN INTENTS */

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    const speechText = 'Puedes pedirme información de un Pokémon, prueba pidiendo por nombre, número o tipo';
    const repromptTest = 'Di, busca el número 25 o busca a pikachu';

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(repromptTest)
      .withSimpleCard('Ayuda', speechText)
      .getResponse();
  },
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent'
        || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent');
  },
  handle(handlerInput) {
    const speechText = 'Adiós entrenador!';

    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard('', speechText)
      .getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);

    return handlerInput.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`Error handled: ${error.message}`);
    let speechError = 'Lo siento, no pude entenderte, por favor repitelo.'

    if (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.NextIntent') {
      speechError = 'Solo puedes pedir siguiente cuando pides buscar pokemon por tipo'
    }

    return handlerInput.responseBuilder
      .speak(speechError)
      .reprompt(speechError)
      .getResponse();
  },
};

const SystemExceptionHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'System.ExceptionEncountered';
  },
  handle(handlerInput) {
    console.log(`System exception encountered: ${handlerInput.requestEnvelope.request.reason}`);
  },
};

const skillBuilder = alexa.SkillBuilders.custom();

exports.handler = skillBuilder
  .addRequestHandlers(
    LaunchRequestHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    SessionEndedRequestHandler,
    SystemExceptionHandler,
    GetPokemonIntentHandler,
    YesIntentHandler,
    NoIntentHandler,
    NextIntentHandler,
  )
  .addErrorHandlers(ErrorHandler)
  .addRequestInterceptors(getSessionAttributesHelper)
  .lambda();
