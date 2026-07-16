import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../services/api_service.dart';

class AuthState {
  final bool isLoading;
  final String? error;
  final bool isAuthenticated;
  final Map<String, dynamic>? user;

  AuthState({
    this.isLoading = false,
    this.error,
    this.isAuthenticated = false,
    this.user,
  });

  AuthState copyWith({
    bool? isLoading,
    String? error,
    bool? isAuthenticated,
    Map<String, dynamic>? user,
  }) {
    return AuthState(
      isLoading: isLoading ?? this.isLoading,
      error: error,
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      user: user ?? this.user,
    );
  }
}

class AuthNotifier extends Notifier<AuthState> {
  @override
  AuthState build() {
    _init();
    return AuthState();
  }

  Future<void> _init() async {
    final api = ApiService();
    await api.init();
    if (api.isAuthenticated) {
      state = state.copyWith(isAuthenticated: true);
      // Opcional: hacer un fetch a /api/auth/me para revalidar el token
    }
  }

  Future<void> login(String email, String password) async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final api = ApiService();
      final response = await api.post('/api/auth/login', {
        'email': email,
        'password': password,
      });

      if (response['ok'] == true && response['token'] != null) {
        await api.setToken(response['token']);
        state = state.copyWith(
          isLoading: false,
          isAuthenticated: true,
          user: response['user'],
        );
      } else {
        state = state.copyWith(isLoading: false, error: response['error'] ?? 'Credenciales inválidas');
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, error: 'Error de conexión: $e');
    }
  }

  Future<void> register(String name, String email, String password) async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final api = ApiService();
      final response = await api.post('/api/auth/register', {
        'name': name,
        'email': email,
        'password': password,
      });

      if (response['ok'] == true && response['token'] != null) {
        await api.setToken(response['token']);
        state = state.copyWith(
          isLoading: false,
          isAuthenticated: true,
          user: response['user'],
        );
      } else {
        state = state.copyWith(isLoading: false, error: response['error'] ?? 'Error al registrarse');
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, error: 'Error de conexión: $e');
    }
  }

  Future<void> loginWithGoogle() async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final googleSignIn = GoogleSignIn.instance;
      await googleSignIn.initialize(
        serverClientId: '181912655817-l553ttb3c4p8q0q6p7kfon2e5p60bfcu.apps.googleusercontent.com',
      );

      await googleSignIn.signOut();

      final googleUser = await googleSignIn.authenticate();
      if (googleUser == null) {
        state = state.copyWith(isLoading: false);
        return;
      }

      final googleAuth = await googleUser.authentication;
      final idToken = googleAuth.idToken;

      if (idToken == null) {
        state = state.copyWith(isLoading: false, error: 'No se pudo obtener el token de Google');
        return;
      }

      final api = ApiService();
      final response = await api.post('/api/auth/google', {
        'credential': idToken,
      });

      if (response['ok'] == true && response['token'] != null) {
        await api.setToken(response['token']);
        state = state.copyWith(
          isLoading: false,
          isAuthenticated: true,
          user: response['user'],
        );
      } else {
        state = state.copyWith(isLoading: false, error: response['error'] ?? 'Error de Google Sign In');
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, error: 'Error al conectar con Google: $e');
    }
  }

  Future<void> logout() async {
    final api = ApiService();
    await api.clearToken();
    state = AuthState(); // Reset a estado inicial (no autenticado)
  }
}

final authProvider = NotifierProvider<AuthNotifier, AuthState>(() {
  return AuthNotifier();
});
