// ios/SignLanguageTranslation/Network/SignLanguageAPIService.swift

import Foundation

enum APIError: Error, LocalizedError {
    case invalidURL
    case requestFailed
    case invalidResponse
    case noData
    case decodingError
    case cancelled
    case timeout
    
    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid URL"
        case .requestFailed: return "Request failed"
        case .invalidResponse: return "Invalid response"
        case .noData: return "No data received"
        case .decodingError: return "Failed to decode response"
        case .cancelled: return "Request cancelled"
        case .timeout: return "Request timed out"
        }
    }
}

class SignLanguageAPIService {
    
    private let config: SignLanguageConfig
    private var currentTask: URLSessionDataTask?
    private let maxRetries: Int = 30
    private let retryDelay: TimeInterval = 1.0
    
    private lazy var session: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 30
        configuration.timeoutIntervalForResource = 60
        return URLSession(configuration: configuration)
    }()
    
    init(config: SignLanguageConfig) {
        self.config = config
        print("[SignLanguageSDK] APIService initialized with config: apiUrl=\(config.apiUrl), apiKey=\(config.apiKey.prefix(10))...")
    }
    
    func getSignVideo(text: String, completion: @escaping (Result<SignModel, APIError>) -> Void) {
        guard var urlComponents = URLComponents(string: "\(config.apiUrl)/Translate") else {
            print("[SignLanguageSDK] ERROR: Invalid URL: \(config.apiUrl)/Translate")
            completion(.failure(.invalidURL))
            return
        }
        
        // Language code mapping: tr -> 1, en -> 2, etc.
        let languageCode: String
        switch config.language {
        case .turkish: languageCode = "1"
        case .english: languageCode = "2"
        case .german: languageCode = "3"
        case .french: languageCode = "4"
        case .spanish: languageCode = "5"
        case .arabic: languageCode = "6"
        }
        
        urlComponents.queryItems = [
            URLQueryItem(name: "s", value: text),
            URLQueryItem(name: "url", value: config.apiUrl),
            URLQueryItem(name: "rk", value: config.apiKey),
            URLQueryItem(name: "fdid", value: config.fdid ?? "16"),
            URLQueryItem(name: "tid", value: config.tid ?? "23"),
            URLQueryItem(name: "language", value: languageCode)
        ]
        
        guard let url = urlComponents.url else {
            print("[SignLanguageSDK] ERROR: Could not build URL from components")
            completion(.failure(.invalidURL))
            return
        }
        
        print("[SignLanguageSDK] Requesting translation for: '\(text)'")
        print("[SignLanguageSDK] Full URL: \(url.absoluteString)")
        
        sendRequestWithRetry(url: url, retryCount: 0, completion: completion)
    }
    
    private func sendRequestWithRetry(
        url: URL,
        retryCount: Int,
        completion: @escaping (Result<SignModel, APIError>) -> Void
    ) {
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(config.apiUrl, forHTTPHeaderField: "Origin")
        
        if retryCount == 0 {
            print("[SignLanguageSDK] Sending request (attempt \(retryCount + 1)/\(maxRetries))...")
        }
        
        currentTask = session.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            
            // Check if cancelled
            if let nsError = error as NSError?, nsError.code == NSURLErrorCancelled {
                print("[SignLanguageSDK] Request cancelled")
                completion(.failure(.cancelled))
                return
            }
            
            // Check for errors
            if let error = error {
                print("[SignLanguageSDK] ERROR: Request failed - \(error.localizedDescription)")
                completion(.failure(.requestFailed))
                return
            }
            
            // Validate response
            guard let httpResponse = response as? HTTPURLResponse else {
                print("[SignLanguageSDK] ERROR: Invalid response type")
                completion(.failure(.invalidResponse))
                return
            }
            
            print("[SignLanguageSDK] Response status code: \(httpResponse.statusCode)")
            
            guard (200...299).contains(httpResponse.statusCode) else {
                print("[SignLanguageSDK] ERROR: HTTP error \(httpResponse.statusCode)")
                completion(.failure(.invalidResponse))
                return
            }
            
            guard let data = data else {
                print("[SignLanguageSDK] ERROR: No data received")
                completion(.failure(.noData))
                return
            }
            
            // Log raw response for debugging
            if let responseString = String(data: data, encoding: .utf8) {
                print("[SignLanguageSDK] Raw response: \(responseString)")
            }
            
            // Decode response
            do {
                let signModel = try JSONDecoder().decode(SignModel.self, from: data)
                
                print("[SignLanguageSDK] Parsed response - state: \(signModel.state ?? false), baseUrl: \(signModel.baseUrl ?? "nil"), name: \(signModel.name ?? "nil")")
                
                // Check if translation is ready
                if signModel.state == true {
                    let videoUrl = signModel.videoUrl ?? "nil"
                    print("[SignLanguageSDK] SUCCESS! Video URL: \(videoUrl)")
                    completion(.success(signModel))
                } else {
                    // Retry if not ready and haven't exceeded max retries
                    if retryCount < self.maxRetries {
                        if retryCount % 5 == 0 {
                            print("[SignLanguageSDK] Translation not ready yet, retrying... (\(retryCount + 1)/\(self.maxRetries))")
                        }
                        DispatchQueue.global().asyncAfter(deadline: .now() + self.retryDelay) { [weak self] in
                            self?.sendRequestWithRetry(
                                url: url,
                                retryCount: retryCount + 1,
                                completion: completion
                            )
                        }
                    } else {
                        print("[SignLanguageSDK] ERROR: Translation timeout after \(self.maxRetries) retries")
                        completion(.failure(.timeout))
                    }
                }
            } catch let decodingError {
                print("[SignLanguageSDK] ERROR: Decoding failed - \(decodingError)")
                completion(.failure(.decodingError))
            }
        }
        
        currentTask?.resume()
    }
    
    func cancelRequest() {
        currentTask?.cancel()
        currentTask = nil
    }
}
