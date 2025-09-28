import pandas as pd
import joblib
from sklearn.neighbors import KNeighborsClassifier

# Load dataset
df = pd.read_csv("yunping_brain.csv")

# Features (x, y, z)
X = df[["x", "y", "z"]].values

# Labels (Consideration)
y = df["Consideration"].astype(str).values
print("Example label:", y[0], type(y[0]))

# Train KNN model
model = KNeighborsClassifier(n_neighbors=1)
model.fit(X, y)

# Save model
joblib.dump(model, "model.pkl")

print("✅ Model trained and saved as model.pkl")
