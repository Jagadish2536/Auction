# API and WebSockets Documentation

This document describes the REST API endpoints and real-time Socket.IO events of the **JV Cricket Auction Platform**.

---

## 🔐 REST API Endpoints

### 1. Authentication
All protected routes require a JWT token passed in the `Authorization` header as `Bearer <token>`.

#### POST `/api/auth/login`
- **Description:** Logs in a user and returns access and refresh tokens.
- **Request Body:**
  ```json
  {
    "email": "your@email.com",
    "password": "yourpassword"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "access_token": "jwt-access-token",
    "refresh_token": "jwt-refresh-token",
    "user": {
      "id": 1,
      "email": "your@email.com",
      "name": "User Name",
      "role": "manager"
    }
  }
  ```

#### GET `/api/auth/me`
- **Description:** Returns profile info of the logged-in user.
- **Headers:** `Authorization: Bearer <access_token>`
- **Response (200 OK):**
  ```json
  {
    "user": {
      "id": 1,
      "email": "your@email.com",
      "name": "User Name",
      "role": "manager"
    }
  }
  ```

---

### 2. Tournaments (Protected)
Manage cricket tournaments.

#### GET `/api/tournaments`
- **Response:** List of all tournaments with team and player counts.

#### POST `/api/tournaments`
- **Content-Type:** `multipart/form-data`
- **Fields:** `name` (required), `description`, `venue`, `start_date`, `end_date`, `auction_date`, `logo` (File).

---

### 3. Teams (Protected)
Manage tournament teams.

#### GET `/api/tournaments/<id>/teams`
- **Response:** List of teams in the tournament.

#### POST `/api/tournaments/<id>/teams`
- **Request Body:**
  ```json
  {
    "name": "Team Name",
    "owner_name": "Owner Name",
    "captain_name": "Captain Name",
    "budget": 1000000.0,
    "max_players": 15
  }
  ```

---

### 4. Players (Protected)
Manage tournament players.

#### GET `/api/tournaments/<id>/players`
- **Parameters:** `status` (optional: `available`, `sold`, `unsold`)
- **Response:** List of players.

#### POST `/api/tournaments/<id>/players`
- **Content-Type:** `multipart/form-data`
- **Fields:** `name` (required), `village`, `mobile`, `playing_style`, `age`, `base_price`, `photo` (File).

#### POST `/api/tournaments/<id>/players/bulk-import`
- **Content-Type:** `multipart/form-data`
- **Fields:** `file` (CSV or Excel sheet with players details).

---

### 5. Public Views (No Auth Required)
Endpoints for public landing page and live viewer.

#### GET `/api/public/tournament`
- **Response:** Current active tournament data, stats, sponsors, advertisements, and recent sold players list.

---

## ⚡ Socket.IO Event Reference

Sockets support real-time bid updates, timer sync, and state broadcasting. The namespace used is the default `/`.

### 1. Connection and Room Management
Clients must join the auction room corresponding to the tournament ID to receive real-time updates.

#### Event: `join_auction` (Client → Server)
- **Request Payload:**
  ```json
  {
    "tournament_id": 1
  }
  ```
- **Description:** Registers the socket to the tournament auction room. Triggers an immediate `auction:state` event broadcasted back to the sender.

---

### 2. Auction Lifecycle Events (Manager Only)

#### Event: `auction:start` (Client → Server)
- **Description:** Starts the auction. Sets status to `live`.

#### Event: `auction:pause` (Client → Server)
- **Description:** Pauses the live auction timer.

#### Event: `auction:resume` (Client → Server)
- **Description:** Resumes the auction timer.

#### Event: `auction:select_player` (Client → Server)
- **Request Payload:**
  ```json
  {
    "player_id": 4
  }
  ```
- **Description:** Selects the player who will be auctioned next. Sets their base price as the initial bid.

#### Event: `auction:sell` (Client → Server)
- **Description:** Marks the current player as sold to the highest bidding team. Updates team budgets and resets the current player.

#### Event: `auction:mark_unsold` (Client → Server)
- **Description:** Marks the current player as unsold, allowing them to be re-auctioned later.

---

### 3. Bidding Events

#### Event: `auction:place_bid` (Client → Server)
- **Request Payload:**
  ```json
  {
    "team_id": 2,
    "amount": 10500.0
  }
  ```
- **Description:** Validates and places a bid for the specified team. Resets the countdown timer back to 30 seconds.

---

### 4. Broadcast Events (Server → Client)

#### Event: `auction:state`
- **Payload:** Full `AuctionFullState` containing the auction state, teams array, stats, and recent sales.

#### Event: `auction:message`
- **Payload:**
  ```json
  {
    "message": "Vizag Warriors bid ₹15,000 for Satish Varma",
    "type": "bid"
  }
  ```
- **Types:** `bid`, `sold`, `unsold`, `warning`, `info`.
