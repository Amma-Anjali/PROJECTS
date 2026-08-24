import streamlit as st
import pandas as pd
import pickle

st.set_page_config(
    page_title="Flight Price Forecasting",
    page_icon="✈️"
)

# -----------------------------
# Load Model
# -----------------------------
@st.cache_resource
def load_model():
    with open("flight_price_model.pkl", "rb") as f:
        model = pickle.load(f)
    return model

model = load_model()


# -----------------------------
# Title
# -----------------------------
st.title("✈️ Flight Price Forecasting")

st.write(
    "Predict the estimated flight price using a trained XGBoost regression model."
)

st.divider()


# -----------------------------
# Input Features
# -----------------------------

airline = st.selectbox(
    "Airline",
    [
        "Air India",
        "GoAir",
        "IndiGo",
        "Jet Airways",
        "Jet Airways Business",
        "Multiple carriers",
        "Multiple carriers Premium economy",
        "SpiceJet",
        "Trujet",
        "Vistara",
        "Vistara Premium economy"
    ]
)

source = st.selectbox(
    "Source",
    [
        "Banglore",
        "Chennai",
        "Delhi",
        "Kolkata",
        "Mumbai"
    ]
)

destination = st.selectbox(
    "Destination",
    [
        "Banglore",
        "Cochin",
        "Delhi",
        "Hyderabad",
        "Kolkata",
        "New Delhi"
    ]
)

total_stops = st.selectbox(
    "Total Stops",
    [0, 1, 2, 3, 4]
)

journey_day = st.number_input(
    "Journey Day",
    min_value=1,
    max_value=31,
    value=15
)

journey_month = st.number_input(
    "Journey Month",
    min_value=1,
    max_value=12,
    value=6
)

duration = st.number_input(
    "Duration (minutes)",
    min_value=30,
    max_value=1500,
    value=180
)

# ⭐ THESE FOUR WERE MISSING
dep_hour = st.number_input(
    "Departure Hour",
    min_value=0,
    max_value=23,
    value=10
)

dep_minute = st.number_input(
    "Departure Minute",
    min_value=0,
    max_value=59,
    value=30
)

arrival_hour = st.number_input(
    "Arrival Hour",
    min_value=0,
    max_value=23,
    value=12
)

arrival_minute = st.number_input(
    "Arrival Minute",
    min_value=0,
    max_value=59,
    value=30
)


# -----------------------------
# Prediction
# -----------------------------

if st.button("Predict Flight Price"):

    # ⭐ ALL FEATURES REQUIRED BY MODEL
    input_data = pd.DataFrame({
        "Airline": [airline],
        "Source": [source],
        "Destination": [destination],
        "Total_Stops": [total_stops],
        "Journey_Day": [journey_day],
        "Journey_Month": [journey_month],
        "Duration_Minutes": [duration],
        "Dep_Hour": [dep_hour],
        "Dep_Minute": [dep_minute],
        "Arrival_Hour": [arrival_hour],
        "Arrival_Minute": [arrival_minute]
    })

    try:

        prediction = model.predict(input_data)[0]

        prediction = max(0, prediction)

        st.success(
            f"### Estimated Flight Price: ₹{prediction:,.2f}"
        )

        st.info(
            "The prediction is generated using the trained XGBoost regression model."
        )

    except Exception as e:

        st.error("Prediction failed.")
        st.code(str(e))